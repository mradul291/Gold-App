frappe.listview_settings['Item Pickup'] = {
    onload: function(listview) {
        // Add Dealer filter field
        let dealer_field = listview.page.add_field({
            fieldtype: 'Link',
            label: 'Dealer',
            fieldname: 'dealer',
            options: 'Supplier'
        });

        // Add Purity filter field (Link to Purity Doctype)
        let purity_field = listview.page.add_field({
            fieldtype: 'Link',
            label: 'Purity',
            fieldname: 'purity',
            options: 'Purity'
        });

        // Place them right after ID search box
        let id_input = listview.page.wrapper.find('.list-search-box');
        $(dealer_field.$wrapper).insertAfter(id_input);
        $(purity_field.$wrapper).insertAfter(dealer_field.$wrapper);

        // Apply Dealer filter
        dealer_field.$input.on("change", function() {
            let value = $(this).val();
            if (value) {
                listview.filter_area.add([['Item Pickup', 'dealer', '=', value]]);
            }
        });

        // Apply Purity filter
        purity_field.$input.on("change", function() {
            let value = $(this).val();
            if (value) {
                listview.filter_area.add([['Item Pickup', 'purity', '=', value]]);
            }
        });
    }
};



