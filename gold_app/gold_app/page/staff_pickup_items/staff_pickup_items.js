frappe.pages["staff-pickup-items"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Staff Pickup Items",
		single_column: true,
	});
	new StaffPickupItemsPage(wrapper);
};

class StaffPickupItemsPage {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.page = wrapper.page;
		this.selected = new Set();
		this.current_dealer = null;
		this.setup();
	}

	setup() {
		this.make_toolbar();
		this.make_container();
		this.show_summary();
	}

	make_toolbar() {
		// Remove default action button
		this.page.set_primary_action(__("Refresh"), () => location.reload());
		this.page.clear_menu();

		// Add Mark Pickup button in the toolbar
		this.page.add_action_item("Mark Pickup", async () => {
			if (!this.current_dealer) {
				frappe.msgprint("Please expand a dealer and select items first");
				return;
			}

			const $selectedCheckboxes = this.container.find(
				".detail-row:visible tbody .item-select:checked"
			);
			if (!$selectedCheckboxes.length) {
				frappe.msgprint("No items selected");
				return;
			}

			const selected = [];
			$selectedCheckboxes.each((_, cb) => selected.push(cb.getAttribute("data-name")));

			const proceed = window.confirm(`Mark ${selected.length} item(s) as Pickup?`);
			if (!proceed) return;

			try {
				await frappe.xcall("gold_app.api.page_api.bulk_update_pickup", {
					docnames: JSON.stringify(selected),
					is_pickup: 1,
				});
				frappe.msgprint(`${selected.length} item(s) marked as Pickup`);
				await this.show_summary();
			} catch (err) {
				console.error(err);
				frappe.msgprint("Failed to mark Pickup");
			}
		});
	}

	make_container() {
		this.container = $('<div class="staff-pickup-container"></div>').appendTo(this.wrapper);
	}

	formatCustomDate(dateStr) {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	async show_summary() {
		this.container.empty();
		this.current_dealer = null;

		let summary = [];
		try {
			summary = await frappe.xcall("gold_app.api.page_api.get_dealer_summary");
		} catch (err) {
			console.error(err);
			this.container.html('<div class="alert alert-danger">Failed to load data</div>');
			return;
		}

		if (!summary.length) {
			this.container.html('<div class="alert alert-info">No data found</div>');
			return;
		}

		const $tbl = $(`
            <table class="table table-sm table-bordered">
                <thead>
                    <tr>
                        <th style="width:36px"></th>
						<th style="width:110px; text-align:center;">
   							<span class="toggle-all" style="cursor:pointer; color:#007bff; text-decoration:underline; user-select:none; text-transform:none;">
	Expand All
</span>

						</th>
                        <th>Customer Name</th>
                        <th>Purities</th>
                        <th>Total Weight (g)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `).appendTo(this.container);

		const $toggleAll = $tbl.find(".toggle-all");
		$toggleAll.on("click", async () => {
			const isShowAll = $toggleAll.text() === "Expand All";
			$toggleAll.text(isShowAll ? "Collapse All" : "Expand All");

			const $rows = $tbody.find("tr[data-dealer]");
			for (const row of $rows) {
				const $tr = $(row);
				const $icon = $tr.find(".toggle-cell i");

				if (isShowAll) {
					// Expand all: show detail row
					if (!$tr.next().hasClass("detail-row")) {
						await this.show_detail($tr.data("dealer"), $tr);
					} else if (!$tr.next().is(":visible")) {
						$tr.next().show();
					}
					$icon.addClass("rotate-down"); // rotate chevron
				} else {
					// Collapse all: hide detail row
					if ($tr.next().hasClass("detail-row") && $tr.next().is(":visible")) {
						$tr.next().hide();
						$icon.removeClass("rotate-down"); // rotate back
					}
				}
			}
		});

		const $tbody = $tbl.find("tbody");

		summary.forEach((d) => {
			const $tr = $(`
<tr data-dealer="${d.dealer}">
    <td class="toggle-cell" style="cursor:pointer; text-align:center;">
        <i class="fa fa-chevron-right"></i>
    </td>
    <td style="text-align:center">
        <input type="checkbox" class="dealer-select"/>
    </td>
    <td><span class="dealer-name">${
		d.dealer_name ? d.dealer_name + " - " + d.dealer : d.dealer
	}</span></td>
    <td>${d.purities}</td>
    <td>${(d.total_weight || 0).toFixed(2)}</td>
</tr>
			`).appendTo($tbody);

			// Expand/collapse dealer items
			$tr.find(".toggle-cell").on("click", async () => {
				this.current_dealer = d.dealer;
				await this.show_detail(d.dealer, $tr);
			});

			// Dealer-level select all
			$tr.find(".dealer-select").on("change", (e) => {
				const checked = $(e.currentTarget).is(":checked");

				// If detail row exists, apply selection directly (no auto-expand)
				if ($tr.next().hasClass("detail-row")) {
					$tr.next()
						.find(".item-select")
						.each((_, cb) => {
							cb.checked = checked;
						});
					$tr.next().find(".select-all").prop("checked", checked);
				}
			});
		});
	}

	async show_detail(dealer, $row) {
		if ($row.next().hasClass("detail-row")) {
			$row.next().toggle();
			return;
		}

		let items = [];
		try {
			items = await frappe.xcall("gold_app.api.page_api.get_staff_pickup_items", { dealer });
		} catch (err) {
			console.error(err);
			frappe.msgprint("Failed to load items");
			return;
		}

		const $detailRow = $(`
            <tr class="detail-row">
                <td colspan="5">
                    <table class="table table-sm table-bordered">
                        <thead>
                            <tr>
                                <th style="width:36px"><input type="checkbox" class="select-all"/></th>
                                <th>Date</th>
                                <th>Customer Name</th>
                                <th>Purity</th>
                                <th>Total Weight (g)</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </td>
            </tr>
        `).insertAfter($row);

		const $detailTbody = $detailRow.find("tbody");

		items.forEach((i) => {
			const dstr = i.date ? this.formatCustomDate(i.date) : "";
			$detailTbody.append(`
                <tr>
                    <td><input type="checkbox" class="item-select" data-name="${i.name}"/></td>
                    <td>${dstr}</td>
                    <td>${i.dealer_name ? i.dealer_name + " - " + i.dealer : i.dealer}</td>
                    <td>${i.purity}</td>
                    <td>${(i.total_weight || 0).toFixed(2)}</td>
                </tr>
            `);
		});

		// Select all checkbox
		$detailRow.find(".select-all").on("change", (e) => {
			const checked = $(e.currentTarget).is(":checked");
			$detailTbody.find(".item-select").each((_, cb) => {
				cb.checked = checked;
			});
		});
	}
}
