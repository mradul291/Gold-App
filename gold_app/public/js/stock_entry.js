frappe.ui.form.on("Stock Entry", {
    source_item: function(frm) {
        if (frm.doc.stock_entry_type === "Break Item" && frm.doc.source_item) {
            frappe.call({
                method: "gold_app.api.stock_entry.get_item_stock_info",
                args: { item_code: frm.doc.source_item },
                callback: function(r) {
                    if (!r.message) return;

                    if (r.message.warehouse) {
                        frm.set_value("source_item_warehouse", r.message.warehouse);
                    }
                    if (r.message.qty !== undefined) {
                        frm.set_value("item_quantity", r.message.qty);
                    }
                    if (r.message.valuation_rate !== undefined) {
                        // per-unit valuation rate of source item
                        frm.set_value("source_valuation_rate", r.message.valuation_rate);
                    }

                    // push the per-unit rate to all child rows (except source row, if present)
                    refresh_child_rates_from_source(frm);
                }
            });
        }
    },

    validate: function(frm) {
        if (frm.doc.stock_entry_type === "Break Item") {
            recalc_reduce_qty_and_guard(frm);
        }
    }
});

frappe.ui.form.on("Stock Entry Detail", {
    items_add: function(frm, cdt, cdn) {
        // default to zero-valuation allowed; will be flipped off if we have a rate
        frappe.model.set_value(cdt, cdn, "allow_zero_valuation_rate", 1);
        // apply rate if available
        apply_source_rate_to_row(frm, cdt, cdn);
        frm.refresh_field("items");
    },

    item_code: function(frm, cdt, cdn) {
        if (frm.doc.stock_entry_type !== "Break Item") return;
        apply_source_rate_to_row(frm, cdt, cdn);
        recalc_reduce_qty_and_guard(frm);
    },

    qty: function(frm, cdt, cdn) {
        if (frm.doc.stock_entry_type !== "Break Item") return;
        // rate is per-unit; just ensure it's set (no proportional math)
        apply_source_rate_to_row(frm, cdt, cdn);
        recalc_reduce_qty_and_guard(frm);
    }
});

/* ---------- helpers ---------- */

function apply_source_rate_to_row(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    if (!row || !row.item_code) return;
    if (row.item_code === frm.doc.source_item) return; // skip source item row if present

    const per_unit_rate = flt(frm.doc.source_valuation_rate) || 0;

    if (per_unit_rate > 0) {
        frappe.model.set_value(cdt, cdn, "basic_rate", per_unit_rate);
        frappe.model.set_value(cdt, cdn, "allow_zero_valuation_rate", 0);
    } else {
        // no rate available → allow zero valuation temporarily
        frappe.model.set_value(cdt, cdn, "allow_zero_valuation_rate", 1);
    }
}

function refresh_child_rates_from_source(frm) {
    if (frm.doc.stock_entry_type !== "Break Item") return;
    (frm.doc.items || []).forEach(d => {
        if (d.item_code && d.item_code !== frm.doc.source_item) {
            apply_source_rate_to_row(frm, d.doctype, d.name);
        }
    });
    frm.refresh_field("items");
}

function recalc_reduce_qty_and_guard(frm) {
    let total_qty = 0;
    (frm.doc.items || []).forEach(row => {
        if (row.item_code && row.item_code !== frm.doc.source_item) {
            total_qty += flt(row.qty);
        }
    });

    frm.set_value("reduce_quantity", total_qty);

    // Guard: child total must not exceed source qty
    const source_qty = flt(frm.doc.item_quantity) || 0;
    if (source_qty > 0 && total_qty > source_qty) {
        frappe.throw(__("The total weight of new items ({0} gm) cannot be greater than the source item weight ({1} gm).", [total_qty, source_qty]));
    }
}

// frappe.ui.form.on("Stock Entry", {
//     stock_entry_type(frm) {
//         frm.set_query("source_item", () => {
//             if (frm.doc.stock_entry_type === "Break Item") {
//                 return {
//                     filters: {
//                         item_group: "MG - Mixed Gold"
//                     }
//                 };
//             }
//         });
//     }
// });
