// Rate Calculation based on Qty and Amount
frappe.ui.form.on("Purchase Receipt Item", {
	amount: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.qty && row.qty != 0) {
			// Custom reverse calculation
			row.rate = flt(row.amount) / flt(row.qty);
			frm.refresh_field("items");
		}
	},

	// Optional: keep ERPNext default flow intact
	rate: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.qty) {
			row.amount = flt(row.qty) * flt(row.rate);
			frm.refresh_field("items");
		}
	},

	qty: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.rate) {
			row.amount = flt(row.qty) * flt(row.rate);
		} else if (row.amount) {
			row.rate = flt(row.amount) / flt(row.qty);
		}
		frm.refresh_field("items");
	},
});

//Supplier based on Group
frappe.ui.form.on("Purchase Receipt", {
	supplier_type: function (frm) {
		frm.set_query("supplier", function () {
			return {
				filters: {
					supplier_group: frm.doc.supplier_type,
				},
			};
		});
	},
});

//Remove Default Downloan and Upload Buttons from Child Table
frappe.ui.form.on("Purchase Receipt", {
	refresh: function (frm) {
		if (frm.fields_dict.items && frm.fields_dict.items.grid) {
			// Hide "Download" button
			frm.fields_dict.items.grid.wrapper.find(".grid-download").hide();

			// Hide "Upload" button
			frm.fields_dict.items.grid.wrapper.find(".grid-upload").hide();
		}
	},
});

// Auto Item Code and Group Selection on the Basis of Purity.
frappe.ui.form.on("Purchase Receipt Item", {
	purity: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.purity) {
			let target_item_code = "Unsorted-" + row.purity;

			frappe.db.get_value("Item", target_item_code, "item_group", function (r) {
				if (r && r.item_group === "MG - Mixed Gold") {
					frappe.model.set_value(cdt, cdn, "item_code", target_item_code);
				} else {
					frappe.msgprint(
						__("Item {0} not found in MG - Mixed Gold group", [target_item_code])
					);
					frappe.model.set_value(cdt, cdn, "item_code", "");
				}
			});
		}
	},
});

// Fetching Supplier Bank Info
frappe.ui.form.on("Purchase Receipt", {
	payment_method: function (frm) {
		if (frm.doc.payment_method === "Bank Transfer" && frm.doc.supplier) {
			frappe.db
				.get_value("Supplier", frm.doc.supplier, ["bank_name", "bank_account_number"])
				.then((r) => {
					if (r && r.message) {
						frm.set_value("supplier_bank_name", r.message.bank_name || "");
						frm.set_value(
							"supplier_bank_account_number",
							r.message.bank_account_number || ""
						);
					}
				});
		} else {
			frm.set_value("supplier_bank_name", "");
			frm.set_value("supplier_bank_account_number", "");
		}
	},
});

// Auto fill 2 rows on the Mix payment method section
frappe.ui.form.on("Purchase Receipt", {
	payment_method(frm) {
		if (frm.doc.payment_method === "Mix") {
			frm.toggle_display("payment_split", true);

			// Only add default rows if table is empty
			if (!frm.doc.payment_split || frm.doc.payment_split.length === 0) {
				let bank_row = frm.add_child("payment_split");
				bank_row.mode_of_payment = "Bank Transfer";
				bank_row.amount = 0.0;

				let cash_row = frm.add_child("payment_split");
				cash_row.mode_of_payment = "Cash";
				cash_row.amount = 0.0;

				frm.refresh_field("payment_split");
			}
		} else {
			frm.toggle_display("payment_split", false);
		}
	},
});

// Hide Multiple Add + Upload Button from Items
frappe.ui.form.on("Purchase Receipt", {
	refresh(frm) {
		setTimeout(() => {
			frm.fields_dict.items.grid.wrapper
				.find(".grid-add-multiple-rows, .grid-upload")
				.remove();
		}, 500);
	},
});

// Clearing Rate field each Time
frappe.ui.form.on("Purchase Receipt Item", {
	item_code: function (frm, cdt, cdn) {
		let row = frappe.get_doc(cdt, cdn);

		// Small delay so that ERPNext finishes auto-fetch first
		setTimeout(() => {
			frappe.model.set_value(cdt, cdn, "rate", 0); // Or leave blank ""
		}, 600);
	},
});

//Payment Method Customer Payable
frappe.ui.form.on("Purchase Receipt", {
	payment_method: function (frm) {
		if (frm.doc.payment_method === "Customer Payable Account") {
			frm.set_df_property("customer_payable_account", "hidden", 0);
		} else {
			frm.set_df_property("customer_payable_account", "hidden", 1);
		}
	},
	onload: function (frm) {
		// Run once when form loads
		frm.trigger("payment_method");
	},
});

// ID number selection field
frappe.ui.form.on("Purchase Receipt", {
	supplier: function(frm) {
		if (frm.doc.supplier) {
			frappe.db.get_doc("Supplier", frm.doc.supplier).then(supplier => {
				// If Malaysian ID exists, use it; else use Other ID Number
				const id_number = supplier.malaysian_id || supplier.other_id_number || "";
				frm.set_value("supplier_id_number", id_number);
			});
		} else {
			frm.set_value("supplier_id_number", "");
		}
	}
});

// Client Script for Purchase Receipt
frappe.ui.form.on("Purchase Receipt", {
	onload_post_render: function (frm) {
		hide_supplier_name_field(frm);
		setTimeout(() => hide_supplier_name_field(frm), 250);
	},

	refresh: function (frm) {
		hide_supplier_name_field(frm);
	},

	supplier: function (frm) {
		setTimeout(() => hide_supplier_name_field(frm), 100);
	},
});

// Function to hide and enforce hidden property (scoped to Purchase Receipt)
function hide_supplier_name_field(frm) {
	try {
		if (!frm || frm.doc.doctype !== "Purchase Receipt") return;

		// 1) Update Frappe's metadata to hidden
		frm.set_df_property("supplier_name", "hidden", 1);

		// 2) Restrict to this form only — use the wrapper of the current form
		const wrapper = frm.$wrapper;
		if (!wrapper) return;

		// 3) Selector limited to this form wrapper
		const selector = '[data-fieldname="supplier_name"], .form-group.field-supplier_name';

		wrapper.find(selector).each(function () {
			$(this).hide();
		});

		// 4) Hide field wrapper if accessible via fields_dict
		if (frm.fields_dict?.supplier_name?.$wrapper) {
			frm.fields_dict.supplier_name.$wrapper.hide();
		}

		// 5) Scoped MutationObserver (only once per Purchase Receipt form)
		if (!frm._hideSupplierNameObserverAttached) {
			const observer = new MutationObserver((mutations) => {
				for (const mut of mutations) {
					for (const node of mut.addedNodes || []) {
						const $node = $(node);
						if ($node.closest(wrapper).length) {
							if ($node.is(selector) || $node.find(selector).length) {
								$node.find(selector).addBack(selector).hide();
							}
						}
					}
				}
			});

			observer.observe(wrapper[0], { childList: true, subtree: true });
			frm._hideSupplierNameObserverAttached = true;
			frm._hideSupplierNameObserver = observer;
		}
	} catch (err) {
		console.error("hide_supplier_name_field error:", err);
	}
}

// Pop up Bank Details field if Not Found for the customer to Add and Do Bank Transfer
frappe.ui.form.on("Purchase Receipt", {
	payment_method: function (frm) {
		if (frm.doc.payment_method === "Bank Transfer" && frm.doc.supplier) {
			frappe.db
				.get_value("Supplier", frm.doc.supplier, ["bank_name", "bank_account_number"])
				.then((r) => {
					if (r && r.message) {
						let { bank_name, bank_account_number } = r.message;

						if (bank_name && bank_account_number) {
							// Case 1: Supplier has existing bank details
							frm.set_value("supplier_bank_name", bank_name);
							frm.set_value("supplier_bank_account_number", bank_account_number);
						} else {
							// Case 2: Missing details → ask user to input
							frappe.prompt(
								[
									{
										label: "Bank Name",
										fieldname: "bank_name",
										fieldtype: "Data",
										reqd: 1,
									},
									{
										label: "Bank Account Number",
										fieldname: "bank_account_number",
										fieldtype: "Data",
										reqd: 1,
									},
								],
								function (values) {
									// Update PR fields
									frm.set_value("supplier_bank_name", values.bank_name);
									frm.set_value(
										"supplier_bank_account_number",
										values.bank_account_number
									);

									// Update Supplier record as well
									frappe.db
										.set_value("Supplier", frm.doc.supplier, {
											bank_name: values.bank_name,
											bank_account_number: values.bank_account_number,
										})
										.then(() => {
											frappe.show_alert({
												message: __(
													"Supplier bank details saved successfully."
												),
												indicator: "green",
											});
										});
								},
								__("Enter Supplier Bank Details"),
								__("Save")
							);
						}
					}
				});
		} else {
			// Clear if other method chosen
			frm.set_value("supplier_bank_name", "");
			frm.set_value("supplier_bank_account_number", "");
		}
	},
});
