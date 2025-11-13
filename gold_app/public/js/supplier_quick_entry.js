frappe.ui.form.SupplierQuickEntryForm = class SupplierQuickEntryForm extends (
	frappe.ui.form.ContactAddressQuickEntryForm
) {
	constructor(doctype, after_insert, init_callback, doc, force) {
		super(doctype, after_insert, init_callback, doc, force);
		this.skip_redirect_on_error = true;
	}

	render_dialog() {
		super.render_dialog();
		const dialog = this.dialog;
		dialog.set_title(__("New Customer"));

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
				dialog.set_value(
					"malaysian_id",
					`${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
				);
			});
		}

		// --- Mobile Number validation (enhanced with NA option) ---
		const mobile_field = dialog.get_field("mobile_number");
		if (mobile_field && mobile_field.$input) {
			mobile_field.$input.on("blur", () => {
				// SKIP ALL VALIDATION IF NA IS CHECKED
				if (dialog.get_value("mobile_number_na")) return;

				let val = mobile_field.$input.val() || "";
				if (!val) return;

				let digits = val.replace(/\D/g, "");

				if (digits.length !== 10 && digits.length !== 11) {
					frappe.msgprint(__("Mobile number must be 10 or 11 digits"));
					return;
				}

				let formatted;
				if (digits.length === 10) {
					formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`;
				} else {
					formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;
				}

				dialog.set_value("mobile_number", formatted);
			});
		}

		// --- Toggle Mobile Number Mandatory State Based on NA Checkbox ---
		const mobile_na_field = dialog.get_field("mobile_number_na");
		if (mobile_na_field && mobile_na_field.$input) {
			mobile_na_field.$input.on("change", () => {
				const is_na = dialog.get_value("mobile_number_na");
				const mobile_f = dialog.get_field("mobile_number");

				dialog.set_df_property("mobile_number", "reqd", is_na ? 0 : 1);

				if (is_na) {
					dialog.set_value("mobile_number", "");
				}

				mobile_f.refresh();
			});
		}

		// --- Primary Save Action ---
		dialog.set_primary_action(__("Save"), async () => {
			const nationality = dialog.get_value("customer_nationality");
			const mid_val = dialog.get_value("malaysian_id");

			const mobile_val = dialog.get_value("mobile_number") || "";
			const mobile_digits = mobile_val.replace(/\D/g, "");
			const mobile_na = dialog.get_value("mobile_number_na");

			if (nationality === "Malaysian") {
				if (!mid_val || mid_val.replace(/\D/g, "").length !== 12) {
					frappe.msgprint(
						__("Please enter a valid 12-digit Malaysian ID before saving.")
					);
					return;
				}
			}

			if (!mobile_na) {
				if (!mobile_val || (mobile_digits.length !== 10 && mobile_digits.length !== 11)) {
					frappe.msgprint(
						__("Please enter a valid 10 or 11-digit mobile number before saving.")
					);
					return;
				}
			}

			await this.insert();
		});
	}

	get_variant_fields() {
		let fields = [
			{
				label: __("Mobile Number"),
				fieldname: "mobile_number",
				fieldtype: "Data",
				reqd: 1,
			},
			{
				label: __("Mobile Number NA"),
				fieldname: "mobile_number_na",
				fieldtype: "Check",
				default: 0,
			},
		];
		return fields;
	}
};
