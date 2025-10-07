frappe.ui.form.on("Supplier", {
	// Run on form load
	onload: function(frm) {
		toggle_id_fields(frm);
	},

	// Run when customer_nationality changes
	customer_nationality: function (frm) {
		toggle_id_fields(frm);
	},

	// Malaysian ID formatting & validation
	malaysian_id: function (frm) {
		if (frm.doc.malaysian_id) {
			let digits = frm.doc.malaysian_id.replace(/\D/g, "");

			if (digits.length !== 12) {
				frappe.msgprint(__("Malaysian ID must be exactly 12 digits"));
				return;
			}

			let formatted =
				digits.slice(0, 6) + "-" + digits.slice(6, 8) + "-" + digits.slice(8, 12);
			frm.set_value("malaysian_id", formatted);
		}
	}
});

// Helper function to toggle fields based on nationality
function toggle_id_fields(frm) {
	if (frm.doc.customer_nationality === "Malaysian") {
		frm.set_df_property("malaysian_id", "reqd", 1);
		frm.set_df_property("malaysian_id", "hidden", 0);

		frm.set_df_property("other_id_type", "reqd", 0);
		frm.set_df_property("other_id_type", "hidden", 1);

		frm.set_df_property("other_id_number", "reqd", 0);
		frm.set_df_property("other_id_number", "hidden", 1);
	} else {
		frm.set_df_property("malaysian_id", "reqd", 0);
		frm.set_df_property("malaysian_id", "hidden", 1);

		frm.set_df_property("other_id_type", "reqd", 1);
		frm.set_df_property("other_id_type", "hidden", 0);

		frm.set_df_property("other_id_number", "reqd", 1);
		frm.set_df_property("other_id_number", "hidden", 0);
	}
}
