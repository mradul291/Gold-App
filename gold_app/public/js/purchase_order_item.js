frappe.ui.form.on('Purchase Order Item', {
    item_code: function(frm, cdt, cdn) {
        frappe.model.set_value(cdt, cdn, "qty", 1);
        fetch_item_fields(frm, cdt, cdn);
        calculate_custom_amount(frm, cdt, cdn);
    },
    custom_valuation_rate_po: function(frm, cdt, cdn) {
        calculate_custom_amount(frm, cdt, cdn);
    },
    weight_per_unit: function(frm, cdt, cdn) {
        calculate_custom_amount(frm, cdt, cdn);
    }
});

function fetch_item_fields(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (row.item_code) {
        frappe.db.get_value("Item", row.item_code, ["item_tag", "purity"], function(values) {
            frappe.model.set_value(cdt, cdn, "item_tag", values.item_tag || "");
            frappe.model.set_value(cdt, cdn, "purity", values.purity || "");
        });
    }
}

function calculate_custom_amount(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let weight = flt(row.weight_per_unit || 0);
    let valuation = flt(row.custom_valuation_rate_po || 0);
    let amount = weight * valuation;

    frappe.model.set_value(cdt, cdn, "qty", weight);
    frappe.model.set_value(cdt, cdn, "rate", valuation);
    frappe.model.set_value(cdt, cdn, "amount", amount);
}
