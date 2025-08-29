frappe.ui.form.on('Item Pickup', {
    refresh: function(frm) {
        frm.set_query("assigned_to", function() {
            return {
                query: "gold_app.api.api.get_staff_users"
            };
        });
    }
});


frappe.ui.form.on("Item Pickup", {
    setup: function(frm) {
        frappe.meta.get_docfield("Item Pickup", "assigned_to").get_query = function() {
            return {
                query: "gold_app.api.api.get_staff_users"
            };
        };
    }
});