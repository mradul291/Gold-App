WHOLESALE_WAREHOUSE = "Bag 1 - Wholesale - AGSB"

@frappe.whitelist()
def create_stock_entry_from_pool(purity_data, pool_name=None, remaining_transfers=None):
    """
    Create Break Item Stock Entry(ies) from pool data.
    Also auto-transfers remaining weight (only for processed purities)
    to Bag 1 - Wholesale - AGSB via Material Transfer Stock Entry.
    """
    data = json.loads(purity_data)

    if not pool_name:
        frappe.throw(_("Pool name is required"))

    if not data:
        frappe.throw(_("No items found to create Stock Entry"))
        
    if remaining_transfers:
        remaining_transfers = json.loads(remaining_transfers)

    pool_doc = frappe.get_doc("Gold Pool", pool_name)

    company = frappe.db.get_single_value("Global Defaults", "default_company") \
        or frappe.db.get_value("Company", {}, "name")

    rows = []
    for r in data:
        purity = str(r.get("purity") or "")
        if not purity:
            frappe.throw(_("Purity is required in each row"))
            
        if not r.get("item_code") and r.get("item_group"):
            created = bulk_create_items([r])
            r["item_code"] = created[0]["item_code"] if created else None
        
        source_item = r.get("source_item") or f"Unsorted-{purity}"
        rows.append({
            "purity": purity,
            "qty": flt(r.get("qty") or 0),
            "item_code": r.get("item_code"),
            "item_length": r.get("item_length"),
            "valuation_rate": flt(r.get("valuation_rate") or 0),
            "target_warehouse": r.get("target_warehouse"),
            "item_group": r.get("item_group"),
            "source_item": source_item
        })

    # Group rows by source_item
    groups = {}
    for r in rows:
        groups.setdefault(r["source_item"], []).append(r)

    created_entries = []
    processed_purities = set()

    # Create Break Item Stock Entry per group
    for source_item_code, group_rows in groups.items():
        if not frappe.db.exists("Item", {"item_code": source_item_code, "item_group": "MG - Mixed Gold"}):
            frappe.throw(_("Source Item '{0}' not found in Item Group 'MG - Mixed Gold'").format(source_item_code))

        latest_sle = frappe.db.get_value(
            "Stock Ledger Entry",
            {"item_code": source_item_code},
            ["warehouse", "valuation_rate"],
            order_by="posting_date desc, posting_time desc",
            as_dict=True
        )
        source_warehouse = latest_sle.warehouse if latest_sle else None
        source_valuation_rate = flt(latest_sle.valuation_rate if latest_sle else 0)

        if not source_warehouse:
            source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item_code}, "warehouse")

        available_qty = flt(frappe.db.get_value(
            "Bin",
            {"item_code": source_item_code, "warehouse": source_warehouse},
            "actual_qty"
        ) or 0)

        reduce_qty = sum([r["qty"] for r in group_rows])
        if reduce_qty > available_qty:
            frappe.throw(_("Qty {0} exceeds available {1} for {2}").format(reduce_qty, available_qty, source_item_code))

        # Build Break Item Stock Entry
        se = frappe.new_doc("Stock Entry")
        se.stock_entry_type = "Break Item"
        se.company = company
        se.posting_date = nowdate()
        se.posting_time = nowtime()
        se.source_item = source_item_code
        se.source_item_warehouse = source_warehouse
        se.item_quantity = available_qty
        se.source_valuation_rate = source_valuation_rate
        se.reduce_quantity = reduce_qty
        se.remaining_quantity = available_qty - reduce_qty

        for r in group_rows:
            item_code = r["item_code"]
            if not frappe.db.exists("Item", item_code):
                new_item = frappe.new_doc("Item")
                new_item.item_code = item_code
                new_item.item_name = item_code
                new_item.item_group = r["item_group"] or "All Item Groups"
                new_item.stock_uom = "Gram"
                new_item.insert(ignore_permissions=True)

            se.append("items", {
                "item_code": item_code,
                "qty": r["qty"],
                "t_warehouse": r["target_warehouse"],
                "purity": r["purity"],
                "item_length": flt(r.get("item_length")) if r.get("item_length") not in (None, "", "null") else None,
                "valuation_rate": r["valuation_rate"],
                "allow_zero_valuation_rate": 1 if r["valuation_rate"] == 0 else 0
            })

            # Update pool breakdown only for this purity
            for row_pb in pool_doc.purity_breakdown:
                if str(row_pb.purity) == r["purity"]:
                    if r["qty"] > row_pb.total_weight:
                        frappe.throw(_("Qty {0} > available {1} for Purity {2}").format(
                            r["qty"], row_pb.total_weight, r["purity"]))
                    row_pb.total_weight -= r["qty"]
                    row_pb.total_cost = row_pb.total_weight * row_pb.avco_rate
                    processed_purities.add(r["purity"])
                    break

        pool_doc.save(ignore_permissions=True)

        se.insert(ignore_permissions=True)
        se.submit()
        created_entries.append(se.name)

    # Handle remaining weights ONLY for processed purities
    for row_pb in pool_doc.purity_breakdown:
        if str(row_pb.purity) not in processed_purities:
            continue  # skip purities not in this transaction

        if flt(row_pb.total_weight) > 0:
            source_item = f"Unsorted-{row_pb.purity}"
            if not frappe.db.exists("Item", {"item_code": source_item, "item_group": "MG - Mixed Gold"}):
                continue

            source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item}, "warehouse")
            if not source_warehouse:
                continue
            
            # Find the user-selected target warehouse from remaining_transfers
            target_wh = WHOLESALE_WAREHOUSE  # fallback
            if remaining_transfers:
                for rt in remaining_transfers:
                    if str(rt.get("purity")) == str(row_pb.purity):
                        target_wh = rt.get("target_warehouse") or WHOLESALE_WAREHOUSE
                        break

            # Create Material Transfer for remaining weight
            se_transfer = frappe.new_doc("Stock Entry")
            se_transfer.stock_entry_type = "Material Transfer"
            se_transfer.company = company
            se_transfer.posting_date = nowdate()
            se_transfer.posting_time = nowtime()
            se_transfer.append("items", {
                "item_code": source_item,
                "qty": flt(row_pb.total_weight),
                "s_warehouse": source_warehouse,
                "t_warehouse": target_wh,
                "allow_zero_valuation_rate": 1
            })
            se_transfer.insert(ignore_permissions=True)
            se_transfer.submit()
            
            row_pb.total_weight = 0
            row_pb.total_cost = 0

    pool_doc.save(ignore_permissions=True)

    if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
        pool_doc.status = "Completed"
        pool_doc.save(ignore_permissions=True)
    # ✅ Collect created item rows for frontend display
    created_items = []
    for se_name in created_entries:
            se_doc = frappe.get_doc("Stock Entry", se_name)
            for it in se_doc.items:
                created_items.append({
                "purity": getattr(it, "purity", None),
                "item_code": it.item_code,
                "qty": it.qty,
                "target_warehouse": it.t_warehouse,
                "source_item": getattr(se_doc, "source_item", None)
            })

    return {
        "name": created_entries[0] if created_entries else None,
        "all_names": created_entries,
        "stock_entry_type": "Break Item",
        "created_items": created_items
    }

