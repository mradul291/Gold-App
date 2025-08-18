// frappe.ui.form.on("Stock Entry", {
//     source_item: function(frm) {
//         if (frm.doc.stock_entry_type === "Break Item" && frm.doc.source_item) {
//             frappe.call({
//                 method: "gold_app.api.stock_entry.get_item_stock_info", 
//                 args: {
//                     item_code: frm.doc.source_item
//                 },
//                 callback: function(r) {
//                     if (r.message) {
//                         if (r.message.warehouse) {
//                             frm.set_value("source_item_warehouse", r.message.warehouse);
//                         }
//                         if (r.message.qty !== undefined) {
//                             frm.set_value("item_quantity", r.message.qty);
//                         }
//                     }
//                 }
//             });
//         }
//     },
//     validate: function(frm) {
//         if (frm.doc.stock_entry_type === "Break Item") {
//             let total_qty = 0;
//             (frm.doc.items || []).forEach(row => {
//                 if (row.item_code !== frm.doc.source_item) {
//                     total_qty += flt(row.qty);
//                 }
//             });
//             frm.set_value("reduce_quantity", total_qty);
//         }
//     }
// });

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
                            frm.set_value("source_item_warehouse", r.message.warehouse);
                        }
                        if (r.message.qty !== undefined) {
                            frm.set_value("item_quantity", r.message.qty);
                        }
                        if (r.message.valuation_rate !== undefined) {
                            frm.set_value("source_valuation_rate", r.message.valuation_rate);
                        }
                    }
                }
            });
        }
    },
    validate: function(frm) {
        if (frm.doc.stock_entry_type === "Break Item") {
            let total_qty = 0;
            (frm.doc.items || []).forEach(row => {
                if (row.item_code !== frm.doc.source_item) {
                    total_qty += flt(row.qty);
                }
            });
            frm.set_value("reduce_quantity", total_qty);
        }
    }
});

frappe.ui.form.on("Stock Entry Detail", {
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (frm.doc.stock_entry_type === "Break Item" && frm.doc.source_item) {
            frappe.call({
                method: "gold_app.api.stock_entry.get_item_stock_info",
                args: { item_code: frm.doc.source_item },
                callback: function(r) {
                    if (r.message) {
                        let source_qty = r.message.qty || 0;
                        let source_rate = r.message.valuation_rate || 0;

                        if (source_qty > 0 && row.qty > 0) {
                            // proportional valuation per qty
                            row.basic_rate = (source_rate / source_qty) * row.qty;
                            frm.refresh_field("items");
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
