frappe.ui.form.on("Stock Entry", {
    source_item: function(frm) {
        if (frm.doc.stock_entry_type === "Break Item" && frm.doc.source_item) {
            frappe.call({
                method: "gold_app.api.stock_entry.get_item_stock_info", 
                args: {
                    item_code: frm.doc.source_item
                },
                callback: function(r) {
                    if (r.message) {
                        if (r.message.warehouse) {
                            // frm.set_value("from_warehouse", r.message.warehouse);
                        }
                        if (r.message.qty !== undefined) {
                            frm.set_value("item_quantity", r.message.qty);
                        }
                    }
                }
            });
        }
    }
});

frappe.ui.form.on('Stock Entry Detail', {
    items_add: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        row.allow_zero_valuation_rate = 1;
        frm.refresh_field("items");
    }
});
