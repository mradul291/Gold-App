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
