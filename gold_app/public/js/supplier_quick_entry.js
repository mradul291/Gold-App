frappe.ui.form.SupplierQuickEntryForm = class SupplierQuickEntryForm extends frappe.ui.form.QuickEntryForm {
	constructor(doctype, after_insert, init_callback, doc, force) {
		super(doctype, after_insert, init_callback, doc, force);
		this.skip_redirect_on_error = true;
	}

	render_dialog() {
		super.render_dialog();
		const dialog = this.dialog;

        dialog.set_title(__('New Customer'));

		// --- Nationality toggle ---
		const toggle_nationality = () => {
			const nationality = dialog.get_value("customer_nationality");
			const mid_field = dialog.get_field("malaysian_id");
			const other_type_field = dialog.get_field("other_id_type");
			const other_num_field = dialog.get_field("other_id_number");
			if (!mid_field || !other_type_field || !other_num_field) return;

			if (nationality === "Malaysian") {
				dialog.set_df_property("malaysian_id", "reqd", 1);
				mid_field.$wrapper.show();

				dialog.set_df_property("other_id_type", "reqd", 0);
				dialog.set_df_property("other_id_number", "reqd", 0);
				other_type_field.$wrapper.hide();
				other_num_field.$wrapper.hide();
			} else {
				dialog.set_df_property("malaysian_id", "reqd", 0);
				mid_field.$wrapper.hide();

				dialog.set_df_property("other_id_type", "reqd", 1);
				dialog.set_df_property("other_id_number", "reqd", 1);
				other_type_field.$wrapper.show();
				other_num_field.$wrapper.show();
			}
		};

		// Bind on change & initial toggle
		frappe.after_ajax(() => {
			const nationality_field = dialog.get_field("customer_nationality");
			if (nationality_field && nationality_field.$input) {
				nationality_field.$input.on("change", toggle_nationality);
			}
			setTimeout(toggle_nationality, 200);
		});

		// --- Malaysian ID validation ---
		const mid_field = dialog.get_field("malaysian_id");
		if (mid_field && mid_field.$input) {
			mid_field.$input.on("blur", () => {
				let val = mid_field.$input.val() || "";
				if (!val) return;
				let digits = val.replace(/\D/g, "");
				if (digits.length !== 12) {
					frappe.msgprint(__("Malaysian ID must be exactly 12 digits"));
					return;
				}
				dialog.set_value("malaysian_id", `${digits.slice(0,6)}-${digits.slice(6,8)}-${digits.slice(8)}`);
			});
		}

		// --- Save button properly overridden ---
		dialog.set_primary_action(__("Save"), async () => {
			const nationality = dialog.get_value("customer_nationality");
			const mid_val = dialog.get_value("malaysian_id");

			if (nationality === "Malaysian") {
				const digits = (mid_val || "").replace(/\D/g, "");
				if (!digits || digits.length !== 12) {
					frappe.msgprint(__("Please enter a valid 12-digit Malaysian ID before saving."));
					return;
				}
			}

			// Call the original QuickEntry insert method
			await this.insert();
		});
	}

	get_variant_fields() {
		const fields = super.get_variant_fields();
		const needed = ["customer_nationality", "malaysian_id", "other_id_type", "other_id_number"];
		const present = fields.map(f => f.fieldname);

		if (!present.includes("customer_nationality")) {
			fields.push({
				fieldtype: "Select",
				label: __("Customer Nationality"),
				fieldname: "customer_nationality",
				options: "Malaysian\nOthers",
				reqd: 1
			});
		}
		if (!present.includes("malaysian_id")) {
			fields.push({ fieldtype: "Data", label: __("Malaysian ID"), fieldname: "malaysian_id" });
		}
		if (!present.includes("other_id_type")) {
			fields.push({ fieldtype: "Select", label: __("Other ID Type"), fieldname: "other_id_type", options: "Aadhar\nPassport" });
		}
		if (!present.includes("other_id_number")) {
			fields.push({ fieldtype: "Data", label: __("Other ID Number"), fieldname: "other_id_number" });
		}
		return fields;
	}
};