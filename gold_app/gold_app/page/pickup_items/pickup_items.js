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
		this.selected_dealers = new Set();
		this.only_nonpickup = false;
		this.isExpandingAll = false;
		this.setup();
	}

	setup() {
		this.page.set_title(__("Pickup Items"));
		this.make_toolbar();
		this.make_filters();
		this.make_container();
		this.show_overview();
		this.show_dealer_summary();
	}

	make_toolbar() {
		this.page.set_primary_action(__("Refresh"), () => location.reload());
		this.page.add_action_item(__("Assign To"), () => this.assign_selected_to());
		this.page.add_action_item(__("Mark Pickup"), () => this.change_selected_pickup(true));
	}

	make_filters() {}

	make_container() {
		this.container = $('<div class="pickup-items-container"></div>').appendTo(this.wrapper);
		this.overview_container = $(
			'<div class="pickup-overview-container mb-4 fade-container"></div>'
		).appendTo(this.container);

		this.summary_container = $('<div class="pickup-summary-container"></div>').appendTo(
			this.container
		);
	}

	formatCustomDate(dateInput) {
		if (!dateInput) return "";

		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

		if (isNaN(date)) return "";

		return date.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}
	formatDateRange(rangeStr) {
		if (!rangeStr) return "";

		// split by " - " (with spaces around dash)
		const parts = rangeStr.split(" - ");
		if (parts.length !== 2) return this.formatCustomDate(rangeStr);

		// parts[0] = "30-09-2025"
		// parts[1] = "30-09-2025"

		const parseDMY = (str) => {
			const [day, month, year] = str.split("-");
			return new Date(`${year}-${month}-${day}`); // convert to YYYY-MM-DD
		};

		const start = this.formatCustomDate(parseDMY(parts[0]));
		const end = this.formatCustomDate(parseDMY(parts[1]));

		return `${start} – ${end}`; // en dash
	}

	async show_overview(selectedDealers = null) {
		this.overview_container.empty(); // only empty after fade out

		if (!this.isExpandingAll) {
			const $loading = $(`
        <div class="loading-state text-center p-4">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only">Loading...</span>
            </div>
            <div class="mt-2 text-muted">Loading overview...</div>
        </div>
    `).appendTo(this.overview_container);
		}

		let dealerArg = null;
		if (selectedDealers) {
			if (Array.isArray(selectedDealers)) {
				dealerArg = selectedDealers.join(",");
			} else {
				dealerArg = selectedDealers;
				selectedDealers = [selectedDealers];
			}
		}

		let overview_data = {};
		try {
			overview_data = await frappe.xcall(
				"gold_app.api.page_api.get_pending_pickup_overview",
				{ dealer: dealerArg }
			);
		} catch (err) {
			console.error(err);
			this.overview_container
				.html('<div class="alert alert-danger">Failed to load overview</div>')
				.fadeIn(200);
			return;
		}
		this.overview_container.empty();

		if (!overview_data || (!overview_data.total && !overview_data.selected)) {
			this.overview_container
				.html('<div class="alert alert-info">No overview data found</div>')
				.fadeIn(200);
			return;
		}

		// Table wrapper
		const $wrapper = $(`
        <div class="overview-table-wrapper">
            <table class="table table-hover table-sm modern-overview-table">
                <thead>
                    <tr>
                        <th colspan="8" class="text-center table-title">Pending Pick-up Items Overview</th>
                    </tr>
                    <tr>
                        <th colspan="4" class="text-center table-subtitle">Total Overview</th>
                       <th colspan="4" class="text-center table-subtitle">
    ${
		selectedDealers
			? `Selected Dealer Overview (${selectedDealers.join(", ")})`
			: "Selected Dealer Overview"
	}
</th>

                    </tr>
                    <tr>
                        <th>Purity</th>
                        <th>Weight (g)</th>
                        <th>Avco (RM/g)</th>
                        <th>Amount (RM)</th>
                        <th>Purity</th>
                        <th>Weight (g)</th>
                        <th>Avco (RM/g)</th>
                        <th>Amount (RM)</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `);
		this.overview_container.empty();
		$wrapper.appendTo(this.overview_container).hide().fadeIn(220);

		const $tbody = $wrapper.find("tbody");

		let purities = [
			...new Set([
				...Object.keys(overview_data.total || {}),
				...Object.keys(overview_data.selected || {}),
			]),
		];

		purities.sort((a, b) => parseFloat(b) - parseFloat(a));

		purities.forEach((purity) => {
			const total = overview_data.total?.[purity] || {};
			const selected = overview_data.selected?.[purity] || {};

			// Skip rows where selected.weight is 0
			if (selectedDealers && (!selected.weight || selected.weight === 0)) return;

			$tbody.append(`
            <tr>
                <td>${purity}</td>
                <td>${(total.weight || 0).toFixed(2)}</td>
                <td>${total.avco ? "RM" + total.avco.toFixed(2) : ""}</td>
                <td>${total.amount ? "RM" + total.amount.toLocaleString() : ""}</td>
                <td>${purity}</td>
                <td>${(selected.weight || 0).toFixed(2)}</td>
                <td>${selected.avco ? "RM" + selected.avco.toFixed(2) : ""}</td>
                <td>${selected.amount ? "RM" + selected.amount.toLocaleString() : ""}</td>
            </tr>
        `);
		});
		this.overview_container.fadeIn(200);
	}

	async show_dealer_summary() {
		this.selected.clear();
		this.summary_container.empty();

		let dealers = [];
		try {
			dealers = await frappe.xcall("gold_app.api.page_api.get_dealer_summary");
		} catch (err) {
			console.error(err);
			this.container.html(
				'<div class="alert alert-danger ml-5 mr-5">Failed to load dealers</div>'
			);
			return;
		}

		if (!dealers || dealers.length === 0) {
			this.container.html('<div class="alert alert-info ml-5 mr-5">No dealers found.</div>');
			return;
		}

		const $tbl = $(`
        <table class="table table-sm dealer-summary-table">
          <thead>
            <tr>
              <th style="width:36px"></th>
			  <th style="width:110px; text-align:center;">
  				<span id="expand-all-dealers" style="cursor:pointer; color:#007bff; text-decoration:underline;">
    				Expand All
  				</span>
			  </th>
              <th>Date Range</th>
              <th>Dealer</th>
              <th>Purities</th>
              <th style="text-align:right">Total Weight (g)</th>
              <th style="text-align:right">Avg AvCo (RM/g)</th>
              <th style="text-align:right">Total Amount (MYR)</th>
			  <th style="width:80px; text-align:center;">Transactions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
    `).appendTo(this.summary_container);

		const $tbody = $tbl.find("tbody");

		dealers.forEach((d) => {
			const $tr = $(`
            <tr class="dealer-row" data-dealer="${frappe.utils.escape_html(d.dealer)}">
              <td style="text-align:center;">
                <i class="fa fa-chevron-right toggle-purity" style="cursor:pointer;"></i>
              </td>
			  <td style="text-align:center;">
  				<input type="checkbox" class="select-dealer" data-dealer="${frappe.utils.escape_html(
					d.dealer
				)}" />
			  </td>
			  <td>${this.formatDateRange(d.date_range)}</td>
              <td>${frappe.utils.escape_html(d.dealer)}</td>
              <td>${frappe.utils.escape_html(d.purities || "")}</td>
              <td class="text-right">${(d.total_weight || 0).toFixed(2)}</td>
              <td class="text-right">${(d.avco_rate || 0).toFixed(2)}</td>
              <td class="text-right">RM ${(d.amount || 0).toFixed(2)}</td>
              <td class="text-center">
               <span class="toggle-transactions" style="cursor:pointer; text-decoration:underline; color:#007bff;" title="View Transactions">
                View
               </span>
              </td>
            </tr>
        `).appendTo($tbody);

			const $transactionsRow = $(`
            <tr class="dealer-transactions d-none" data-dealer="${frappe.utils.escape_html(
				d.dealer
			)}">
                <td colspan="9">
                    <div class="transactions-container">Loading transactions...</div>
                </td>
            </tr>
        `).appendTo($tbody);

			$tr.find(".toggle-transactions").on("click", async (e) => {
				e.stopPropagation();
				const $container = $transactionsRow.find(".transactions-container");
				const showing = !$transactionsRow.hasClass("d-none");

				if (showing) $transactionsRow.addClass("d-none");
				else {
					if (!$container.data("loaded")) {
						$container.html('<div class="text-muted">Loading transactions...</div>');
						await this.render_transactions($container, d.dealer);
						$container.data("loaded", true);
					}
					$transactionsRow.removeClass("d-none");
				}
			});

			const $details = $(`
            <tr class="dealer-detail d-none" data-dealer="${frappe.utils.escape_html(d.dealer)}">
                <td colspan="9"><div class="purity-container">Loading...</div></td>
            </tr>
        `).appendTo($tbody);

			$tr.find(".toggle-purity").on("click", async () => {
				const icon = $tr.find(".toggle-purity");
				const showing = !$details.hasClass("d-none");

				if (showing) {
					$details.addClass("d-none");
					icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
					this.selected_dealers.delete(d.dealer);

					// Only update overview if NOT expanding all
					if (!this.isExpandingAll) {
						await this.show_overview(Array.from(this.selected_dealers));
					}
				} else {
					icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
					// toggle dealer selection
					const dealerName = d.dealer;
					if (this.selected_dealers.has(dealerName))
						this.selected_dealers.delete(dealerName);
					else this.selected_dealers.add(dealerName);

					if (!this.isExpandingAll) {
						await this.show_overview(Array.from(this.selected_dealers));
					}

					// Load purities
					const $container = $details.find(".purity-container");
					if (!$container.data("loaded")) {
						$container.html('<div class="text-muted">Loading purities...</div>');
						let rows = [];
						try {
							rows = await frappe.xcall("gold_app.api.page_api.get_summary", {
								dealer: dealerName,
							});
						} catch (err) {
							console.error(err);
							$container.html(
								'<div class="text-danger">Failed to load purities</div>'
							);
							$container.data("loaded", true);
							return;
						}
						this.render_purities($container, dealerName, rows);
						$container.data("loaded", true);
					}

					$details.removeClass("d-none");
				}
			});

			$tr.find(".select-dealer").on("change", async (e) => {
				const dealerName = $(e.target).data("dealer");
				const $dealerRow = $tbl.find(`.dealer-row[data-dealer='${dealerName}']`);
				const $transactionsRow = $tbl.find(
					`.dealer-transactions[data-dealer='${dealerName}']`
				);
				const $toggle = $dealerRow.find(".toggle-transactions");

				if (e.target.checked) {
					// Open transactions if not already visible
					if ($transactionsRow.hasClass("d-none")) {
						$toggle.trigger("click");
					}

					// Select all transactions for this dealer
					$transactionsRow.find(".select-transaction").each(function () {
						$(this).prop("checked", true).trigger("change");
					});
				} else {
					// Deselect all transactions for this dealer
					$transactionsRow.find(".select-transaction").each(function () {
						$(this).prop("checked", false).trigger("change");
					});
				}
			});
		});

		// ---- Expand/Collapse All Dealers + Purities + Items functionality ----
		let allExpanded = false; // Track toggle state

		$("#expand-all-dealers").on("click", async () => {
			const $tbl = $(".dealer-summary-table");
			const dealerRows = $tbl.find(".dealer-row");

			if (!allExpanded) {
				this.isExpandingAll = true;

				// Show spinner
				this.overview_container.html(`
        <div class="loading-state text-center p-4">
            <div class="spinner-border text-primary" role="status"></div>
            <div class="mt-2 text-muted">Loading all dealers...</div>
        </div>
    `);

				// Let browser render the spinner
				await new Promise((resolve) => requestAnimationFrame(resolve));

				const dealerPromises = dealerRows
					.map((i, row) => {
						const $row = $(row);
						const dealerName = $row.data("dealer");
						const $purityToggle = $row.find(".toggle-purity");
						const $details = $tbl.find(`.dealer-detail[data-dealer='${dealerName}']`);
						const $container = $details.find(".purity-container");

						if (!$container.data("loaded")) {
							return (async () => {
								if ($details.hasClass("d-none")) {
									// Skip show_overview during expand all
									this.isExpandingAll = true;
									$purityToggle.trigger("click");
								}

								// Wait until purities are loaded
								await new Promise((resolve2) => {
									const interval = setInterval(() => {
										if ($container.data("loaded")) {
											clearInterval(interval);
											resolve2();
										}
									}, 50);
								});
							})();
						} else {
							return Promise.resolve();
						}
					})
					.get();

				// Wait for all dealers
				await Promise.all(dealerPromises);

				// Show overview only once
				this.selected_dealers = new Set(
					dealerRows.map((i, r) => $(r).data("dealer")).get()
				);
				await this.show_overview(Array.from(this.selected_dealers));

				this.isExpandingAll = false;
				allExpanded = true;
				$("#expand-all-dealers").text("Collapse All");
			} else {
				// Collapse All logic stays mostly same
				for (let i = 0; i < dealerRows.length; i++) {
					const $row = $(dealerRows[i]);
					const dealerName = $row.data("dealer");

					const $transactionsRow = $tbl.find(
						`.dealer-transactions[data-dealer='${dealerName}']`
					);
					const $purityToggle = $row.find(".toggle-purity");
					const $purityDetail = $tbl.find(`.dealer-detail[data-dealer='${dealerName}']`);

					// Collapse items inside purities
					const $purityRows = $purityDetail.find(".purity-row");
					for (let j = 0; j < $purityRows.length; j++) {
						const $purityRow = $($purityRows[j]);
						const $itemToggle = $purityRow.find(".toggle-cell");
						const $itemsRow = $purityDetail.find(
							`.purity-detail[data-purity='${$purityRow.data("purity")}']`
						);
						if (!$itemsRow.hasClass("d-none")) await $itemToggle.trigger("click");
					}

					// Collapse purities
					if (!$purityDetail.hasClass("d-none")) await $purityToggle.trigger("click");

					// Collapse transactions
					const $toggle = $row.find(".toggle-transactions");
					if (!$transactionsRow.hasClass("d-none")) await $toggle.trigger("click");
				}

				allExpanded = false;
				$("#expand-all-dealers").text("Expand All");

				// Clear selected dealers and reload default overview once
				this.selected_dealers.clear();
				await this.show_overview();
			}
		});
	}

	// ---- Dealer summary with expand for purities ----
	render_purities($container, dealer, rows) {
		$container.empty();
		if (!rows || rows.length === 0) {
			$container.html('<div class="text-muted">No purities found for this dealer.</div>');
			return;
		}

		const nested = {};
		rows.forEach((r) => {
			const p = r.purity || "Unknown";
			nested[p] = nested[p] || { pickup: null, nonpickup: null };
			if (r.is_pickup) nested[p].pickup = r;
			else nested[p].nonpickup = r;
		});

		const purities = Object.keys(nested).sort();
		const $tbl = $(`
        <table class="table table-sm table-bordered">
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Purity</th>
              <th style="text-align:right">Total Weight</th>
              <th style="text-align:right">Avg AvCo</th>
              <th style="text-align:right">Total Amount</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
    `).appendTo($container);

		const $tbody = $tbl.find("tbody");

		purities.forEach((purity) => {
			const group = nested[purity];
			const displayRow = group.nonpickup ||
				group.pickup || { total_weight: 0, avco_rate: 0, amount: 0 };

			const $tr = $(`
            <tr class="purity-row" data-purity="${frappe.utils.escape_html(purity)}">
              <td class="toggle-cell" style="cursor:pointer; text-align:center;"><i class="fa fa-chevron-right"></i></td>
              <td>${frappe.utils.escape_html(purity)}</td>
              <td class="text-right">${(displayRow.total_weight || 0).toFixed(2)}</td>
              <td class="text-right">${(displayRow.avco_rate || 0).toFixed(2)}</td>
              <td class="text-right">${(displayRow.amount || 0).toFixed(2)}</td>
            </tr>
        `).appendTo($tbody);

			const $details = $(
				`<tr class="purity-detail d-none" data-purity="${frappe.utils.escape_html(
					purity
				)}"><td colspan="6"><div class="detail-container p-2">Loading...</div></td></tr>`
			).appendTo($tbody);

			// toggle to show items
			$tr.find(".toggle-cell").on("click", async () => {
				const icon = $tr.find(".fa");
				const showing = !$details.hasClass("d-none");
				if (showing) {
					$details.addClass("d-none");
					icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
				} else {
					icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
					const $container = $details.find(".detail-container");
					if (!$container.data("loaded")) {
						let items = [];
						try {
							items = await frappe.xcall("gold_app.api.page_api.get_items", {
								dealer,
								purity,
							});
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
		});
	}
	// ---- Dealer Transactions Table ----
	async render_transactions($container, dealer, is_pickup = 0) {
		$container.html('<div class="text-muted">Transactions List</div>');

		let items = [];
		try {
			items = await frappe.xcall("gold_app.api.page_api.get_staff_pickup_items", {
				dealer: dealer,
				is_pickup: is_pickup,
			});
		} catch (err) {
			console.error(err);
			$container.html('<div class="text-danger">Failed to load transactions</div>');
			return;
		}

		if (!items.length) {
			$container.html('<div class="alert alert-info">No transactions found</div>');
			return;
		}

		const $tbl = $(`
        <table class="table table-sm table-bordered transaction-table mt-2">
            <thead>
                <tr>
				    <th><input type="checkbox" id="select-all-transactions" /></th>
                    <th>Date</th>
                    <th>Item Code</th>
                    <th>Purity</th>
                    <th>Weight (g)</th>
                    <th>Avco (RM/g)</th>
                    <th>Amount (RM)</th>
                    <th>Purchase Receipt</th>
					<th>Assign Status</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `).appendTo($container);

		const $tbody = $tbl.find("tbody");

		items.forEach((item) => {
			const assignStatus = item.assigned_to
				? `<span class="badge badge-assigned">Assigned</span>`
				: `<span class="badge badge-pending">Pending</span>`;

			$tbody.append(`
            <tr>
				<td class="text-center">
                	<input type="checkbox" class="select-transaction" data-id="${item.name}">
           	 	</td>
                <td>${this.formatCustomDate(item.date)}</td>
                <td>${frappe.utils.escape_html(item.item_code)}</td>
                <td>${frappe.utils.escape_html(item.purity)}</td>
                <td class="text-right">${(item.total_weight || 0).toFixed(2)}</td>
                <td class="text-right">${
					item.avco_rate ? "RM" + item.avco_rate.toFixed(2) : ""
				}</td>
                <td class="text-right">${
					item.amount ? "RM" + item.amount.toLocaleString() : ""
				}</td>
                <td>${frappe.utils.escape_html(item.purchase_receipt || "")}</td>
				<td class="text-center">${assignStatus}</td>
            </tr>
        `);
		});

		// Keep track of selected transaction IDs
		this.selected = new Set();

		const me = this;

		// Handle individual checkbox change
		$tbl.find(".select-transaction").on("change", function () {
			const id = $(this).data("id");
			if (this.checked) {
				me.selected.add(id);
			} else {
				me.selected.delete(id);
			}
		});

		// Handle "Select All" checkbox
		$tbl.find("#select-all-transactions").on("change", function () {
			const checked = this.checked;
			$tbl.find(".select-transaction").each(function () {
				$(this).prop("checked", checked).trigger("change");
			});
		});
	}

	// ---- refresh / purity / items flow (reused) ----
	async refresh() {
		this.selected.clear();
		this.summary_container.empty();
		await this.show_overview(this.current_dealer);

		const dealer = this.current_dealer;
		if (!dealer) {
			// show dealer list if none selected
			await this.show_dealer_summary();
			return;
		}

		// call server for summary (purity-level)
		let rows = [];
		try {
			rows = await frappe.xcall("gold_app.api.page_api.get_summary", { dealer: dealer });
		} catch (err) {
			console.error(err);
			this.summary_container.html(
				'<div class="alert alert-danger ml-5 mr-5">Error loading data. Check console.</div>'
			);
			return;
		}

		const nested = {};
		rows.forEach((r) => {
			const p = r.purity || "Unknown";
			nested[p] = nested[p] || { pickup: null, nonpickup: null };
			if (r.is_pickup) nested[p].pickup = r;
			else nested[p].nonpickup = r;
		});

		const purities = Object.keys(nested).sort();
		const purities_to_render = this.only_nonpickup
			? purities.filter((p) => nested[p].nonpickup)
			: purities;

		// header
		$(`
            <div class="mb-2 ml-5">
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

		$(
			`<div class="mb-3 mr-5 text-right text-muted">Dealer Totals — Weight: ${dealer_weight.toFixed(
				2
			)} g, Amount: ${dealer_amount.toFixed(2)} MYR</div>`
		).appendTo(this.container);

		// table header
		const $table = $(`<table class="table table-sm table-bordered"><thead>
            <tr>
              <th style="width:36px"></th>
              <th>Purity</th>
              <th style="text-align:right">Total Weight (g)</th>
              <th style="text-align:right">Avg AvCo (RM/g)</th>
              <th style="text-align:right">Total Amount (MYR)</th>
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
			const displayRow = group.nonpickup ||
				group.pickup || { total_weight: 0, avco_rate: 0, amount: 0, is_pickup: 0 };

			const $tr = $(`
                <tr class="purity-row" data-purity="${frappe.utils.escape_html(purity)}">
                  <td class="toggle-cell" style="cursor:pointer; text-align:center;"><i class="fa fa-chevron-right"></i></td>
                  <td>${frappe.utils.escape_html(purity)}</td>
                  <td style="text-align:right">${(displayRow.total_weight || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(displayRow.avco_rate || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(displayRow.amount || 0).toFixed(2)}</td>
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
		}
	}

	render_items($container, items) {
		$container.empty();
		if (!items || items.length === 0) {
			$container.html('<div class="text-muted">No items found for this purity.</div>');
			return;
		}

		const $tbl = $(`
            <table class="table table-sm table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item Code</th>
                  <th style="text-align:right">Weight (g)</th>
                  <th style="text-align:right">AvCo (RM/g)</th>
                  <th style="text-align:right">Amount (MYR)</th>
                  <th>Purchase Receipt</th>
				  <th>Status</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
        `).appendTo($container);

		const $tbody = $tbl.find("tbody");

		items.forEach((it) => {
			const dstr = this.formatCustomDate(it.date);
			const $tr = $(`
                <tr>
                  <td>${frappe.utils.escape_html(dstr)}</td>
                  <td>${frappe.utils.escape_html(it.item_code || "")}</td>
                  <td style="text-align:right">${(it.total_weight || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(it.avco_rate || 0).toFixed(2)}</td>
                  <td style="text-align:right">${(it.amount || 0).toFixed(2)}</td>
                  <td>${frappe.utils.escape_html(it.purchase_receipt || "")}</td>
				 <td class="item-status" style="text-align:center" data-name="${it.name}">
    				<span class="badge ${it.assigned_to ? "badge-assigned" : "badge-pending"}">
        				${it.assigned_to ? "Assigned" : "Pending"}
    				</span>
				</td>
                </tr>
            `).appendTo($tbody);
		});
	}

	async change_selected_pickup(is_pickup) {
		if (!this.selected.size) {
			frappe.msgprint(__("No rows selected"));
			return;
		}

		const proceed = window.confirm(
			`Are you sure you want to mark ${this.selected.size} item(s) as ${
				is_pickup ? "Pickup" : "Non-Pickup"
			}?`
		);
		if (!proceed) return;

		const docnames = JSON.stringify(Array.from(this.selected));
		const args = { docnames: docnames, is_pickup: is_pickup ? 1 : 0 };

		let res;
		try {
			res = await frappe.xcall("gold_app.api.page_api.bulk_update_pickup", args);
		} catch (err) {
			console.error(err);
			frappe.msgprint(__("Bulk update failed. Check console for details."));
			return;
		}

		let message = `Updated: ${res.updated || 0}`;
		if (res.skipped && res.skipped.length) message += `\nSkipped: ${res.skipped.length}`;
		if (res.errors && res.errors.length)
			message += `\nErrors: ${res.errors.length} (check server logs)`;
		frappe.msgprint(message);

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
					await this.refresh();
				} catch (err) {
					console.error(err);
					frappe.msgprint(__("Assignment failed. Check console for details."));
					return;
				}

				// Show success message
				let message = `Assigned to ${values.user}\nUpdated: ${res.updated || 0}`;
				if (res.skipped && res.skipped.length)
					message += `\nSkipped: ${res.skipped.length}`;
				if (res.errors && res.errors.length)
					message += `\nErrors: ${res.errors.length} (check server logs)`;
				frappe.msgprint(message);

				// Clear selection so user doesn't accidentally reassign
				this.selected.clear();
				$("#select-all-transactions").prop("checked", false);
				$(".item-select").prop("checked", false);
			},
		});

		d.show();
	}
}
