// Copyright (c) 2025, Mradul and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Melt and Assay Sales", {
// 	refresh(frm) {

// 	},
// });
// Add Resume Process button on the server document
frappe.ui.form.on("Melt and Assay Sales", {
	refresh(frm) {
		// show only when doc is saved (not new); adjust condition as required
		if (!frm.is_new()) {
			frm.add_custom_button("Resume Process", () => {
				// open melt page with log_id
				window.location.href = `/app/wholesale-bag-melt?log_id=${encodeURIComponent(
					frm.doc.name
				)}`;
			});
		}
	},
});
