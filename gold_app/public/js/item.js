frappe.ui.form.on("Item", {
	refresh(frm) {
		toggle_retail_fields(frm);
	},

	item_category(frm) {
		toggle_retail_fields(frm);
	},
});

function toggle_retail_fields(frm) {
	let is_retail = frm.doc.item_category === "Retail";

	let retail_fields = [
		"rfid_tag",
		"purchase_date",
		"purchase_transaction_ref",
		"retail_status",
		"sold_date",
		"gross_weight_g",
		"length_size",
	];

	retail_fields.forEach((f) => {
		frm.toggle_display(f, is_retail);
	});
}
