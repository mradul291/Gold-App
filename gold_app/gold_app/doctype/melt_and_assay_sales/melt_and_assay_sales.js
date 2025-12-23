frappe.ui.form.on("Melt and Assay Sales", {
	refresh(frm) {
		// Show only when saved AND not completed
		if (!frm.is_new() && frm.doc.status !== "Completed") {
			frm.add_custom_button("Resume Process", () => {
				window.location.href = `/app/wholesale-bag-melt?log_id=${encodeURIComponent(
					frm.doc.name
				)}`;
			});
		}
	},
});
