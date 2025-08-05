frappe.ui.form.on('Item', {
    item_group: function(frm) {
        if (frm.doc.item_code) return;

        const prefixMap = {
            "Cincin": "C",
            "Rantai Leher": "RL",
            "Rantai Tangan": "RT",
            "Gelang Tangan": "GT",
            "Loket": "L",
            "Gold Bar": "GB"    
        };

        const prefix = prefixMap[frm.doc.item_group];
        if (!prefix) return;

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Item",
                fields: ["item_code"],
                filters: [["item_code", "like", prefix + "-%"]],
                limit_page_length: 1,
                order_by: "creation desc"
            },
            callback: function(r) {
                let next = 1;
                if (r.message.length > 0) {
                    const last_code = r.message[0].item_code;
                    const num = parseInt(last_code.split("-")[1]);
                    next = num + 1;
                }
                frm.set_value("item_code", `${prefix}-${next.toString().padStart(3, '0')}`);
            }
        });
    }
});
