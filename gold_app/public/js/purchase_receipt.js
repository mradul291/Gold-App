// Rate Calculation based on Qty and Amount
frappe.ui.form.on("Purchase Receipt Item", {
    amount: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.qty && row.qty != 0) {
            // Custom reverse calculation
            row.rate = flt(row.amount) / flt(row.qty);
            frm.refresh_field("items");
        }
    },

    // Optional: keep ERPNext default flow intact
    rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.qty) {
            row.amount = flt(row.qty) * flt(row.rate);
            frm.refresh_field("items");
        }
    },

    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.rate) {
            row.amount = flt(row.qty) * flt(row.rate);
        } else if (row.amount) {
            row.rate = flt(row.amount) / flt(row.qty);
        }
        frm.refresh_field("items");
    }
});

// Item Suggestions on the basis of Purity
frappe.ui.form.on('Purchase Receipt Item', {
  purity(frm, cdt, cdn) {
    const rowdoc = locals[cdt][cdn];
    if (!rowdoc.purity) return;

    const grid = frm.fields_dict.items.grid;
    const grid_row = grid.get_row(cdn) || grid.grid_rows_by_docname?.[cdn];

    // Ensure the row editor and the link input exist
    const ensureCtrl = () => {
      // Try both: expanded row form and inline cell editor
      let ctrl =
        grid_row?.grid_form?.fields_dict?.item_code ||
        (grid_row?.get_field ? grid_row.get_field('item_code') : null);

      // If still not available, try expanding the row and re-pulling the control
      if (!ctrl && grid_row?.toggle_view) {
        grid_row.toggle_view(true);
        ctrl =
          grid_row?.grid_form?.fields_dict?.item_code ||
          (grid_row?.get_field ? grid_row.get_field('item_code') : null);
      }
      return ctrl;
    };

    // Give the UI a moment if needed (handles quick changes)
    setTimeout(() => {
      const ctrl = ensureCtrl();
      if (!ctrl || !ctrl.$input) return;

      const txt = String(rowdoc.purity);

      // "Type" into the input without touching the model
      ctrl.$input.val(txt);
      ctrl.$input.trigger('input').trigger('focus');

      // Open suggestions (handles different Frappe builds)
      if (ctrl.awesomplete && typeof ctrl.awesomplete.evaluate === 'function') {
        ctrl.awesomplete.evaluate();
      } else if (typeof ctrl.$input.autocomplete === 'function') {
        try { ctrl.$input.autocomplete('search', txt); } catch (e) {}
      } else {
        ctrl.$input.trigger('keydown');
      }

      // Place caret at end (nice UX)
      const el = ctrl.$input.get(0);
      if (el && el.setSelectionRange) {
        el.setSelectionRange(txt.length, txt.length);
      }
    }, 0);
  }
});
