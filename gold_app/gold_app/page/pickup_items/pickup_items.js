// apps/gold_app/gold_app/page/pickup_items/pickup_items.js
frappe.pages["pickup-items"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Pickup Items",
		single_column: true,
	});
	new PickupItemsPage(wrapper);
};

class PickupItemsPage {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.page = wrapper.page;
		this.selected = new Set();
		this.current_dealer = null;
		this.only_nonpickup = false;
		this.setup();
	}

	setup() {
		this.page.set_title(__("Pickup Items"));
		this.make_toolbar();
		this.make_filters();
		this.make_container();
		// initial hint
		this.container.html(
			'<div class="alert alert-info ml-3 mr-3">Select a Dealer to load pickup summary.</div>'
		);
	}

	make_toolbar() {
		this.page.set_primary_action(__("Mark Pickup"), () => this.change_selected_pickup(true));
        this.page.add_action_item(__("Refresh"), () => this.refresh());
        this.page.add_action_item(__("Assign To"), () => this.assign_selected_to());
		this.page.add_action_item(__("Mark Non-Pickup"), () => this.change_selected_pickup(false));
	}

	make_filters() {
		const $frow = $('<div class="filter-row flex"></div>').appendTo(this.wrapper);
		const $left = $('<div class="col-sm-6"></div>').appendTo($frow);
		const $right = $('<div class="col-sm-6 text-right"></div>').appendTo($frow);

		// Dealer link field
		this.dealer_field = frappe.ui.form.make_control({
			df: {
				fieldtype: "Link",
				label: "Dealer",
				fieldname: "dealer",
				options: "Supplier",
			},
			parent: $left,
			render_input: true,
		});
		// this.dealer_field.make_input();

		// Buttons
		this.$btn_nonpickup = $(
			'<button class="btn btn-default mr-2">Show Non-Pickup</button>'
		).appendTo($right);
		this.$btn_all = $('<button class="btn btn-default">Show All</button>').appendTo($right);

		$(this.dealer_field.input).on("change", () => this.on_dealer_change());
		this.$btn_nonpickup.on("click", () => {
			this.only_nonpickup = true;
			this.refresh();
		});
		this.$btn_all.on("click", () => {
			this.only_nonpickup = false;
			this.refresh();
		});
	}

	make_container() {
		// main area
		this.container = $('<div class="pickup-items-container"></div>').appendTo(this.wrapper);
	}

	async on_dealer_change() {
		const dealer = this.dealer_field.get_value();
		this.current_dealer = dealer;
		this.selected.clear();
		if (!dealer) {
			this.container.html(
				'<div class="alert alert-info ml-3 mr-3">Select a Dealer to load pickup summary.</div>'
			);
			return;
		}
		await this.refresh();
	}

	async refresh() {
		this.selected.clear();
		this.container.empty();

		const dealer = this.current_dealer || this.dealer_field.get_value();
		if (!dealer) {
			this.container.html(
				'<div class="alert alert-info ml-3 mr-3">Select a Dealer to load pickup summary.</div>'
			);
			return;
		}

		// call server for summary
		let rows = [];
		try {
			rows = await frappe.xcall("gold_app.api.page_api.get_summary", { dealer: dealer });
		} catch (err) {
			console.error(err);
			this.container.html(
				'<div class="alert alert-danger">Error loading data. Check console.</div>'
			);
			return;
		}

		// Build nested map: purity => { pickup: row or null, nonpickup: row or null }
		const nested = {};
		rows.forEach((r) => {
			const p = r.purity || "Unknown";
			nested[p] = nested[p] || { pickup: null, nonpickup: null };
			if (r.is_pickup) nested[p].pickup = r;
			else nested[p].nonpickup = r;
		});

		// If only_nonpickup requested, filter purities to those that have nonpickup rows
		const purities = Object.keys(nested).sort();
		const purities_to_render = this.only_nonpickup
			? purities.filter((p) => nested[p].nonpickup)
			: purities;

		// header
		const $hdr = $(`
            <div class="mb-2 ml-3">
              <h5>Dealer: ${frappe.utils.escape_html(dealer)}</h5>
            </div>
        `).appendTo(this.container);

		// totals by dealer (sum both pickup+nonpickup)
		let dealer_weight = 0,
			dealer_amount = 0;
		Object.values(nested).forEach((group) => {
			if (group.pickup) {
				dealer_weight += group.pickup.total_weight || 0;
				dealer_amount += group.pickup.amount || 0;
			}
			if (group.nonpickup) {
				dealer_weight += group.nonpickup.total_weight || 0;
				dealer_amount += group.nonpickup.amount || 0;
			}
		});

		const $dealerTotals = $(`
          <div class="mb-3 mr-3 text-right text-muted">Dealer Totals — Weight: ${dealer_weight.toFixed(
				2
			)} g, Amount: ${dealer_amount.toFixed(2)} MYR</div>
        `).appendTo(this.container);

		// table header
		const $table = $(`<table class="table table-sm table-bordered"><thead>
            <tr>
              <th style="width:36px"></th>
              <th>Purity</th>
              <th style="text-align:right">Total Weight (g)</th>
              <th style="text-align:right">Avg AvCo (RM/g)</th>
              <th style="text-align:right">Total Amount (MYR)</th>
              <th style="width:180px">Actions</th>
            </tr>
        </thead><tbody></tbody></table>`).appendTo(this.container);

		const $tbody = $table.find("tbody");

		if (purities_to_render.length === 0) {
			$tbody.append(
				'<tr><td colspan="6" class="text-center text-muted">No data found for selected filters.</td></tr>'
			);
			return;
		}

		for (const purity of purities_to_render) {
			const group = nested[purity];
			// prefer non-pickup group row for summary display (client expects non-pickup visible)
			const displayRow = group.nonpickup ||
				group.pickup || { total_weight: 0, avco_rate: 0, amount: 0, is_pickup: 0 };

			const $tr = $(`
                <tr class="purity-row" data-purity="${frappe.utils.escape_html(purity)}">
                  <td class="toggle-cell" style="cursor:pointer; text-align:center;"><i class="fa fa-chevron-right"></i></td>
                  <td>${frappe.utils.escape_html(purity)}</td>
                  <td style="text-align:right">${(displayRow.total_weight || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(displayRow.avco_rate || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(displayRow.amount || 0).toFixed(2)}</td>
                  <td>
                    <label class="mr-2"><input type="checkbox" class="purity-select" data-purity="${frappe.utils.escape_html(
						purity
					)}"> Select all</label>
                    <button class="btn btn-xs btn-default view-items" data-purity="${frappe.utils.escape_html(
						purity
					)}">View</button>
                  </td>
                </tr>
            `).appendTo($tbody);

			const $details = $(
				`<tr class="purity-detail d-none" data-purity="${frappe.utils.escape_html(
					purity
				)}"><td colspan="6"><div class="detail-container p-2">Loading...</div></td></tr>`
			).appendTo($tbody);

			// toggle / view handler
			$tr.find(".toggle-cell, .view-items").on("click", async () => {
				const icon = $tr.find(".fa");
				const showing = !$details.hasClass("d-none");
				if (showing) {
					$details.addClass("d-none");
					icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
				} else {
					icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
					const $container = $details.find(".detail-container");
					if (!$container.data("loaded")) {
						$container.html('<div class="text-muted">Loading items...</div>');
						const args = { dealer: dealer, purity: purity };
						// if only_nonpickup is true, request items with is_pickup = 0 so detail shows non-pickup items
						if (this.only_nonpickup) args.is_pickup = 0;
						let items = [];
						try {
							items = await frappe.xcall("gold_app.api.page_api.get_items", args);
						} catch (err) {
							console.error(err);
							$container.html('<div class="text-danger">Failed to load items</div>');
							$container.data("loaded", true);
							return;
						}
						this.render_items($container, items);
						$container.data("loaded", true);
					}
					$details.removeClass("d-none");
				}
			});

			// select-all handler
			$tr.find(".purity-select").on("change", async (e) => {
				const checked = $(e.currentTarget).is(":checked");
				const $container = $details.find(".detail-container");
				if (!$container.data("loaded")) {
					// open details to load items first
					$tr.find(".toggle-cell").trigger("click");
					// small wait (DOM/method) — acceptable for moderate lists
					await new Promise((r) => setTimeout(r, 300));
				}
				$container.find(".item-select").each((i, cb) => {
					cb.checked = checked;
					const name = cb.getAttribute("data-name");
					if (checked) this.selected.add(name);
					else this.selected.delete(name);
				});
				this.update_primary_action_label();
			});
		}

		this.update_primary_action_label();
	}

	render_items($container, items) {
		$container.empty();
		if (!items || items.length === 0) {
			$container.html('<div class="text-muted">No items found for this purity.</div>');
			return;
		}

		const $tbl = $(`
            <table class="table table-sm table-hover ml-3 mr-3">
              <thead>
                <tr>
                  <th style="width:36px"><input type="checkbox" class="detail-select-all" /></th>
                  <th>Date</th>
                  <th>Item Code</th>
                  <th style="text-align:right">Weight (g)</th>
                  <th style="text-align:right">AvCo (RM/g)</th>
                  <th style="text-align:right">Amount (MYR)</th>
                  <th>Purchase Receipt</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
        `).appendTo($container);

		const $tbody = $tbl.find("tbody");

		items.forEach((it) => {
			const dstr = it.date ? frappe.datetime.str_to_user(it.date) : "";
			const $tr = $(`
                <tr>
                  <td><input type="checkbox" class="item-select" data-name="${frappe.utils.escape_html(
						it.name
					)}"></td>
                  <td>${frappe.utils.escape_html(dstr)}</td>
                  <td>${frappe.utils.escape_html(it.item_code || "")}</td>
                  <td style="text-align:right">${(it.total_weight || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(it.avco_rate || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(it.amount || 0).toFixed(2)}</td>
                  <td>${frappe.utils.escape_html(it.purchase_receipt || "")}</td>
                </tr>
            `).appendTo($tbody);

			$tr.find(".item-select").on("change", (e) => {
				const checked = $(e.currentTarget).is(":checked");
				const name = e.currentTarget.getAttribute("data-name");
				if (checked) this.selected.add(name);
				else this.selected.delete(name);
				this.update_primary_action_label();
			});
		});

		// detail-wide select all
		$tbl.find(".detail-select-all").on("change", (e) => {
			const checked = $(e.currentTarget).is(":checked");
			$container.find(".item-select").each((i, cb) => {
				cb.checked = checked;
				const name = cb.getAttribute("data-name");
				if (checked) this.selected.add(name);
				else this.selected.delete(name);
			});
			this.update_primary_action_label();
		});
	}

	update_primary_action_label() {
		const count = this.selected.size;
		const label = count ? `Mark Pickup (${count})` : "Mark Pickup";
		// update primary action callback as well
		this.page.set_primary_action(label, () => this.change_selected_pickup(true));
	}

	async change_selected_pickup(is_pickup) {
		if (!this.selected.size) {
			frappe.msgprint(__("No rows selected"));
			return;
		}

		// Confirmation (native confirm is simple and reliable across versions)
		const proceed = window.confirm(
			`Are you sure you want to mark ${this.selected.size} item(s) as ${
				is_pickup ? "Pickup" : "Non-Pickup"
			}?`
		);
		if (!proceed) return;

		const docnames = JSON.stringify(Array.from(this.selected));
		const args = { docnames: docnames, is_pickup: is_pickup ? 1 : 0 };

		// optionally set assigned_to as the current user
		// args.assigned_to = frappe.session.user;

		let res;
		try {
			res = await frappe.xcall("gold_app.api.page_api.bulk_update_pickup", args);
		} catch (err) {
			console.error(err);
			frappe.msgprint(__("Bulk update failed. Check console for details."));
			return;
		}

		// Show result summary
		let message = `Updated: ${res.updated || 0}`;
		if (res.skipped && res.skipped.length) {
			message += `\nSkipped: ${res.skipped.length}`;
		}
		if (res.errors && res.errors.length) {
			message += `\nErrors: ${res.errors.length} (check server logs)`;
		}
		frappe.msgprint(message);

		// Refresh view
		await this.refresh();
	}

	async assign_selected_to() {
		if (!this.selected.size) {
			frappe.msgprint(__("No rows selected"));
			return;
		}

		const d = new frappe.ui.Dialog({
			title: __("Assign To User"),
			fields: [
				{
					fieldtype: "Link",
					fieldname: "user",
					label: "User",
					options: "User",
					reqd: 1,
					get_query: () => {
						return {
							query: "frappe.core.doctype.user.user.user_query",
							filters: { role: "Staff" },
						};
					},
				},
			],
			primary_action_label: __("Assign"),
			primary_action: async (values) => {
				d.hide();

				const docnames = JSON.stringify(Array.from(this.selected));
				const args = { docnames: docnames, assigned_to: values.user };

				let res;
				try {
					res = await frappe.xcall("gold_app.api.page_api.bulk_update_pickup", args);
				} catch (err) {
					console.error(err);
					frappe.msgprint(__("Assignment failed. Check console for details."));
					return;
				}

				let message = `Assigned to ${values.user}\nUpdated: ${res.updated || 0}`;
				if (res.skipped && res.skipped.length) {
					message += `\nSkipped: ${res.skipped.length}`;
				}
				if (res.errors && res.errors.length) {
					message += `\nErrors: ${res.errors.length} (check server logs)`;
				}
				frappe.msgprint(message);

				await this.refresh();
			},
		});

		d.show();
	}
}
