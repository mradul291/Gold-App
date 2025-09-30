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
    supplier_type: function(frm) {
        frm.set_query("supplier", function() {
            return {
                filters: {
                    supplier_group: frm.doc.supplier_type
                }
            };
        });
    }
});

//Remove Default Downloan and Upload Buttons from Child Table
frappe.ui.form.on("Purchase Receipt", {
    refresh: function(frm) {
        if (frm.fields_dict.items && frm.fields_dict.items.grid) {
            // Hide "Download" button
            frm.fields_dict.items.grid.wrapper
                .find('.grid-download')
                .hide();

            // Hide "Upload" button
            frm.fields_dict.items.grid.wrapper
                .find('.grid-upload')
                .hide();
        }
    }
});

// Auto Item Code and Group Selection on the Basis of Purity.
frappe.ui.form.on("Purchase Receipt Item", {
    purity: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.purity) {
            let target_item_code = "Unsorted-" + row.purity;

            frappe.db.get_value("Item", target_item_code, "item_group", function(r) {
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
    }
});

// Fetching Supplier Bank Info
frappe.ui.form.on("Purchase Receipt", {
    payment_method: function(frm) {
        if (frm.doc.payment_method === "Bank Transfer" && frm.doc.supplier) {
            frappe.db.get_value("Supplier", frm.doc.supplier, ["bank_name", "bank_account_number"])
                .then(r => {
                    if (r && r.message) {
                        frm.set_value("supplier_bank_name", r.message.bank_name || "");
                        frm.set_value("supplier_bank_account_number", r.message.bank_account_number || "");
                    }
                });
        } else {
            frm.set_value("supplier_bank_name", "");
            frm.set_value("supplier_bank_account_number", "");
        }
    }
});

// Auto fill 2 rows on the Mix payment method section
frappe.ui.form.on("Purchase Receipt", {
    payment_method(frm) {
        if (frm.doc.payment_method === "Mix") {
            // Show the payment_split child table (if hidden)
            frm.toggle_display("payment_split", true);

            // Clear any existing rows to avoid duplicates
            frm.clear_table("payment_split");

            // 1st Row - Bank Transfer
            let bank_row = frm.add_child("payment_split");
            bank_row.mode_of_payment = "Bank Transfer";
            bank_row.amount = 0.0;

            // 2nd Row - Cash
            let cash_row = frm.add_child("payment_split");
            cash_row.mode_of_payment = "Cash";
            cash_row.amount = 0.0;

            // Refresh the table so rows show immediately
            frm.refresh_field("payment_split");
        } else {
            // If not Mix, hide the payment_split table
            frm.toggle_display("payment_split", false);
        }
    }
});

// Hide Multiple Add + Upload Button from Items
frappe.ui.form.on('Purchase Receipt', {
    refresh(frm) {
        setTimeout(() => {
            frm.fields_dict.items.grid.wrapper
                .find('.grid-add-multiple-rows, .grid-upload')
                .remove();
        }, 500);
    }
});

// Clearing Rate field each Time
frappe.ui.form.on("Purchase Receipt Item", {
    item_code: function (frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);

        // Small delay so that ERPNext finishes auto-fetch first
        setTimeout(() => {
            frappe.model.set_value(cdt, cdn, "rate", 0); // Or leave blank ""
        }, 600);
    }
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
    }
});


frappe.ui.form.on('Purchase Receipt', {
    supplier_id_number: function(frm) {
        frm.set_query('supplier_id_number', function() {
            return {
                query: "gold_app.api.purchase_receipt.get_supplier_by_id"
            };
        });
    }
});

frappe.ui.form.on('Purchase Receipt', {
    supplier_id_number: function(frm) {
        if (frm.doc.supplier_id_number) {
            frm.set_value('supplier', frm.doc.supplier_id_number);
        }
    }
});

