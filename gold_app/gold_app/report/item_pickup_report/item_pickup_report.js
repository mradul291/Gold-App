frappe.query_reports["Item Pickup Report"] = {
    "filters": [
        {
            "fieldname": "dealer",
            "label": __("Dealer"),
            "fieldtype": "Link",
            "options": "Supplier",
            "reqd": 0
        },
        {
            "fieldname": "purity",
            "label": __("Purity"),
            "fieldtype": "Link",
            "options": "Purity",
            "reqd": 0
        }
    ]
};
