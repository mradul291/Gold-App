frappe.ui.form.on("Wholesale Bag Direct Sale", {
	refresh(frm) {
		if (!frm.is_new() && frm.doc.status !== "Paid") {
			frm.add_custom_button("Resume Process", () => {
				window.location.href = "/app/wholesale-bag-direct?log_id=" + frm.doc.name;
			});
		}
	},
});
