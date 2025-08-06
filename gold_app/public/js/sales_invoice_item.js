frappe.ui.form.on('Sales Invoice Item', {
    item_code: function(frm, cdt, cdn) {
        frappe.model.set_value(cdt, cdn, "qty", 1);
        fetch_item_fields(frm, cdt, cdn);
        update_rate_and_qty(frm, cdt, cdn);
    },
    valuation_rate: function(frm, cdt, cdn) {
        update_rate_and_qty(frm, cdt, cdn);
    },
    weight_per_unit: function(frm, cdt, cdn) {
        update_rate_and_qty(frm, cdt, cdn);
    }
});

// Fetch custom fields from Item
function fetch_item_fields(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (row.item_code) {
        frappe.db.get_value("Item", row.item_code, ["item_tag", "purity"], function(values) {
            frappe.model.set_value(cdt, cdn, "item_tag", values.item_tag || "");
            frappe.model.set_value(cdt, cdn, "purity", values.purity || "");
        });
    }
}

function update_rate_and_qty(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let weight = flt(row.weight_per_unit || 0);
    let valuation = flt(row.valuation_rate || 0);

    frappe.model.set_value(cdt, cdn, "qty", weight);
    frappe.model.set_value(cdt, cdn, "rate", valuation);
}
