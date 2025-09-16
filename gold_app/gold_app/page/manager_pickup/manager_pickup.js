frappe.pages["manager-pickup"].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "Manager Pickup",
        single_column: true
    });
    new ManagerPickupPage(wrapper);
};

class ManagerPickupPage {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = wrapper.page;
        this.container = null;
        this.current_dealer = null;
        this.setup();
    }

    setup() {
        this.make_toolbar();
        this.make_container();
        this.show_summary();
    }

    make_toolbar() {
        this.page.set_primary_action(__("Refresh"), () => this.show_summary());
        this.page.clear_menu();
    }

    make_container() {
        this.container = $('<div class="manager-pickup-container"></div>').appendTo(this.wrapper);
    }

    async show_summary() {
        this.container.empty();

        let items = [];
        try {
            items = await frappe.xcall("gold_app.api.page_api.get_manager_pickup_items", {});
        } catch (err) {
            console.error(err);
            this.container.html('<div class="alert alert-danger">Failed to load data</div>');
            return;
        }

        if (!items.length) {
            this.container.html('<div class="alert alert-info">No pickup items found</div>');
            return;
        }

        // Group items by dealer for summary view
        const grouped = {};
        items.forEach(i => {
            if (!grouped[i.dealer]) {
                grouped[i.dealer] = { dealer: i.dealer, purities: new Set(), total_weight: 0, items: [] };
            }
            grouped[i.dealer].purities.add(i.purity);
            grouped[i.dealer].total_weight += i.total_weight || 0;
            grouped[i.dealer].items.push(i);
        });

        const $tbl = $(`
            <table class="table table-sm table-bordered">
                <thead>
                    <tr>
                        <th style="width:36px"></th>
                        <th>Dealer</th>
                        <th>Purities</th>
                        <th>Total Weight (g)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `).appendTo(this.container);

        const $tbody = $tbl.find("tbody");

        Object.values(grouped).forEach(group => {
            const $tr = $(`
                <tr data-dealer="${group.dealer}">
                    <td class="toggle-cell" style="cursor:pointer;text-align:center;">
                        <i class="fa fa-chevron-right"></i>
                    </td>
                    <td>${group.dealer}</td>
                    <td>${Array.from(group.purities).join(", ")}</td>
                    <td>${group.total_weight.toFixed(2)}</td>
                </tr>
            `).appendTo($tbody);

            $tr.find(".toggle-cell").on("click", async () => {
                this.current_dealer = group.dealer;
                await this.show_detail(group.items, $tr);
            });
        });
    }

    async show_detail(items, $row) {
        // Toggle if detail row already exists
        if ($row.next().hasClass("detail-row")) {
            $row.next().toggle();
            const icon = $row.find(".toggle-cell i");
            icon.toggleClass("fa-chevron-right fa-chevron-down");
            return;
        }

        // Insert detail row
        const $detailRow = $(`
            <tr class="detail-row">
                <td colspan="5">
                    <table class="table table-sm table-bordered">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Dealer</th>
                                <th>Purity</th>
                                <th>Total Weight (g)</th>
                                <th>Amount</th>
                                <th style="text-align:center;">Tick if all ok</th>
                                <th style="width:200px;">Any discrepancies?</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </td>
            </tr>
        `).insertAfter($row);

        const $tbody = $detailRow.find("tbody");

        items.forEach(i => {
            const dstr = i.date ? frappe.datetime.str_to_user(i.date) : "";
            const checked = i.tick_all_ok ? "checked" : "";
            const discrepancyOptions = `
                <option value="">Select</option>
                <option value="Refund Request (ie. Credit Note)" ${i.discrepancy_action === "Refund Request (ie. Credit Note)" ? "selected" : ""}>
                    Refund Request (ie. Credit Note)
                </option>
                <option value="Replace Item" ${i.discrepancy_action === "Replace Item" ? "selected" : ""}>
                    Replace Item
                </option>
                <option value="Other" ${i.discrepancy_action === "Other" ? "selected" : ""}>
                    Other
                </option>
            `;

            const $tr = $(`
                <tr data-name="${i.name}">
                    <td>${dstr}</td>
                    <td>${i.dealer}</td>
                    <td>${i.purity}</td>
                    <td>${(i.total_weight || 0).toFixed(2)}</td>
                    <td>${frappe.format(i.amount, { fieldtype: "Currency" })}</td>
                    <td style="text-align:center;">
                        <input type="checkbox" class="tick-all-ok" ${checked} />
                    </td>
                    <td>
                        <select class="discrepancy-action form-control form-control-sm">
                            ${discrepancyOptions}
                        </select>
                    </td>
                </tr>
            `).appendTo($tbody);

            // Checkbox change handler
            $tr.find(".tick-all-ok").on("change", async (e) => {
                try {
                    await frappe.xcall("frappe.client.set_value", {
                        doctype: "Item Pickup",
                        name: i.name,
                        fieldname: "tick_all_ok",
                        value: e.target.checked ? 1 : 0
                    });
                    frappe.show_alert({ message: __("Updated successfully"), indicator: "green" });
                } catch (err) {
                    console.error(err);
                    frappe.msgprint("Failed to update");
                }
            });

            // Discrepancy dropdown handler
            $tr.find(".discrepancy-action").on("change", async (e) => {
                try {
                    await frappe.xcall("frappe.client.set_value", {
                        doctype: "Item Pickup",
                        name: i.name,
                        fieldname: "discrepancy_action",
                        value: e.target.value
                    });
                    frappe.show_alert({ message: __("Updated successfully"), indicator: "green" });
                } catch (err) {
                    console.error(err);
                    frappe.msgprint("Failed to update");
                }
            });
        });

        // Update chevron icon
        $row.find(".toggle-cell i").removeClass("fa-chevron-right").addClass("fa-chevron-down");
    }
}
