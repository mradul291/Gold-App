frappe.pages["manager-pickup"].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "Manager Pickup",
        single_column: true,
    });
    new ManagerPickupPage(wrapper);
};

class ManagerPickupPage {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = wrapper.page;
        this.container = null;
        this.current_dealer = null;
        this.changes = {};
        this.setup();
    }

    setup() {
        this.make_toolbar();
        this.make_container();
        this.show_summary();
    }

    make_toolbar() {
        this.page.set_primary_action(__("Refresh"), () => this.show_summary());
        this.page.set_secondary_action(__("Save"), () => this.save_changes());
        this.page.clear_menu();
    }

    make_container() {
        this.container = $('<div class="manager-pickup-container"></div>').appendTo(this.wrapper);
    }

    async show_summary() {
        this.container.empty();

        let items = [];
        try {
            items = await frappe.xcall("gold_app.api.page_api.get_manager_pickup_items", {
                is_pickup: 1,
            });
        } catch (err) {
            console.error(err);
            this.container.html('<div class="alert alert-danger">Failed to load data</div>');
            return;
        }

        if (!items.length) {
            this.container.html('<div class="alert alert-info">No pickup items found</div>');
            return;
        }

        const grouped = {};
        items.forEach((i) => {
            if (!grouped[i.dealer]) {
                grouped[i.dealer] = {
                    dealer: i.dealer,
                    purities: new Set(),
                    total_weight: 0,
                    items: [],
                };
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
                        <th>Tick if all ok</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `).appendTo(this.container);

        const $tbody = $tbl.find("tbody");

        Object.values(grouped).forEach((group) => {
            const $tr = $(`
                <tr data-dealer="${group.dealer}">
                    <td class="toggle-cell" style="cursor:pointer;text-align:center;">
                        <i class="fa fa-chevron-right"></i>
                    </td>
                    <td>${group.dealer}</td>
                    <td>${Array.from(group.purities).join(", ")}</td>
                    <td>${group.total_weight.toFixed(2)}</td>
                    <td style="text-align:center;">
                        <input type="checkbox" class="dealer-tick-all-ok" />
                    </td>
                </tr>
            `).appendTo($tbody);

            $tr.find(".toggle-cell").on("click", async () => {
                this.current_dealer = group.dealer;
                await this.show_detail(group.items, $tr);
            });

            $tr.find(".dealer-tick-all-ok").on("change", (e) => {
                const checked = e.target.checked;
                group.items.forEach((item) => {
                    this.track_change(item.name, { tick_all_ok: checked ? 1 : 0 });
                });

                if ($tr.next().hasClass("detail-row")) {
                    $tr.next().find(".tick-all-ok").prop("checked", checked);
                }
            });
        });
    }

    async show_detail(items, $row) {
        if ($row.next().hasClass("detail-row")) {
            $row.next().toggle();
            const icon = $row.find(".toggle-cell i");
            icon.toggleClass("fa-chevron-right fa-chevron-down");
            return;
        }

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
                                 <th>Discrepancy (MYR)</th>
                                <th>Amount</th>
                                <th style="text-align:center;">Tick if ok</th>
                                <th style="width:200px;">Any discrepancies?</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </td>
            </tr>
        `).insertAfter($row);

        const $tbody = $detailRow.find("tbody");

        items.forEach((i) => {
            const dstr = i.date ? frappe.datetime.str_to_user(i.date) : "";
            const checked = i.tick_all_ok ? "checked" : "";
            const discrepancyOptions = `
                <option value="">Select</option>
                <option value="Refund Request (ie. Credit Note)" ${
                    i.discrepancy_action === "Refund Request (ie. Credit Note)" ? "selected" : ""
                }>
                    Refund Request (ie. Credit Note)
                </option>
            `;
            const $tr = $(`
                <tr data-name="${i.name}">
                    <td>${dstr}</td>
                    <td>${i.dealer}</td>
                    <td>${i.purity}</td>
                    <td>${(i.total_weight || 0).toFixed(2)}</td>
                    <td>${i.discrepancy_amount || 0}</td>
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

            $tr.find(".tick-all-ok").on("change", (e) => {
                this.track_change(i.name, { tick_all_ok: e.target.checked ? 1 : 0 });
            });

            // New functionality: prompt for discrepancy_amount
            $tr.find(".discrepancy-action").on("change", async (e) => {
                const val = e.target.value;
                if (val === "Refund Request (ie. Credit Note)") {
                    const weight = await frappe.prompt(
                        [
                            {
                                fieldname: "discrepancy_amount",
                                label: "Discrepancy Amount (MYR)",
                                fieldtype: "Float",
                                reqd: 1,
                            },
                        ],
                        (values) => {
                            this.track_change(i.name, {
                                discrepancy_action: val,
                                discrepancy_amount: values.discrepancy_amount,
                            });
                        },
                        __("Enter Discrepancy Amount"),
                        __("Save")
                    );
                } else {
                    this.track_change(i.name, { discrepancy_action: val, discrepancy_amount: null });
                }
            });
        });

        $row.find(".toggle-cell i").removeClass("fa-chevron-right").addClass("fa-chevron-down");
    }

    track_change(name, update) {
        if (!this.changes[name]) {
            this.changes[name] = { name };
        }
        Object.assign(this.changes[name], update);
        this.page.set_indicator(__("Not Saved"), "orange");
    }

    async save_changes() {
        const updates = Object.values(this.changes);
        if (!updates.length) {
            frappe.show_alert({ message: __("No changes to save"), indicator: "blue" });
            return;
        }

        try {
            frappe.show_progress(__("Saving Changes"), 20, 100, __("Processing..."));
            const result = await frappe.xcall("gold_app.api.page_api.manager_bulk_update_pickup", {
                doc_updates: updates,
            });
            frappe.show_progress(__("Saving Changes"), 100, 100, __("Done"));
            frappe.show_alert({
                message: __(`${result.updated} records updated`),
                indicator: "green",
            });
            this.page.clear_indicator();
            this.changes = {};
            this.show_summary();
        } catch (err) {
            console.error(err);
            frappe.msgprint("Failed to save changes");
        }
    }
}
