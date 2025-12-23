window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.buyer_sale = function ($mount, state) {
	const html = `
        <div class="wbs-root">

            <!-- Title -->
            <div class="wbs-title">Sales Detail</div>

            <!-- FROM ASSAY SECTION -->
            <div class="wbs-card wbs-assay-card">
                <div class="wbs-card-header">FROM ASSAY SECTION</div>

                <div class="wbs-assay-grid">
                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Net Weight</div>
                        <div class="wbs-assay-value" id="wbs-net-weight">—</div>
                    </div>

                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Assay Purity</div>
                        <div class="wbs-assay-value" id="wbs-assay-purity">—</div>
                    </div>

                    <div class="wbs-assay-box">
                        <div class="wbs-assay-label">Net XAU</div>
                        <div class="wbs-assay-value wbs-blue" id="wbs-net-xau">—</div>
                    </div>
                </div>
            </div>

			<!-- CUSTOMER INFO -->
<div class="wbs-card">
	<div class="wbs-card-header">CUSTOMER INFO</div>

	<div class="wbs-customer-grid">
		<div class="wbs-field-block">
			<div class="wbs-field-label">Customer</div>
			<div class="wbs-customer-wrapper" style="position:relative;">
    <input
        id="wbs-customer"
        class="wbs-input"
        placeholder="Select or search customer"
        autocomplete="off"
    />
    <div id="wbs-customer-suggestions"
         class="wbs-customer-suggestions"
         style="display:none;"></div>
</div>

		</div>

		<div class="wbs-field-block">
			<div class="wbs-field-label">ID Number</div>
			<input
				id="wbs-id-number"
				class="wbs-input"
				placeholder="Customer ID"
			/>
		</div>
	</div>
</div>

            <!-- LOCKED RATES -->
            <div class="wbs-section-head">
                <div class="wbs-section-title">Locked Rates</div>
                <button class="wbs-add-btn">+ Add Rate</button>
            </div>

            <div class="wbs-card">
                <div class="wbs-table-head">
                    <div>PRICE PER XAU</div>
                    <div>XAU WEIGHT</div>
                    <div>AMOUNT</div>
                    <div>REMARK</div>
                    <div></div>
                </div>

                <div id="wbs-table-body"></div>

                <div class="wbs-table-total">
                    <div class="wbs-total-label">TOTAL</div>
                    <div class="wbs-total-val" id="wbs-total-xau">0.00 g</div>
                    <div class="wbs-total-amt" id="wbs-total-amount">RM 0.00</div>
                    <div></div>
                    <div></div>
                </div>
            </div>

            <!-- WARNING -->
            <div class="wbs-warning" style="display:none;"></div>

            <!-- SUMMARY -->
            <div class="wbs-card wbs-summary-card">
                <div class="wbs-card-header">SUMMARY</div>

                <div class="wbs-summary-grid">
                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Total XAU Sold</div>
                        <div class="wbs-summary-value" id="wbs-summary-xau">0.00 g</div>
                    </div>

                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Total Revenue</div>
                        <div class="wbs-summary-value wbs-blue" id="wbs-summary-revenue">
                            RM 0.00
                        </div>
                    </div>

                    <div class="wbs-summary-box">
                        <div class="wbs-summary-label">Weighted Avg Rate</div>
                        <div class="wbs-summary-value" id="wbs-summary-rate">0.00</div>
                        <div class="wbs-summary-sub">per gram</div>
                    </div>
                </div>
            </div>

        </div>
    `;

	$mount.html(html);

	// --------------------------------------------------
	// HYDRATE FROM ASSAY + LOCKED RATES
	// --------------------------------------------------
	(function hydrateSale() {
		const assay = state.assay || {};
		const sale = state.sale || {};

		$("#wbs-net-weight").text((assay.net_sellable || 0).toFixed(2) + " g");
		$("#wbs-assay-purity").text((assay.assay_purity || 0).toFixed(2) + "%");
		$("#wbs-net-xau").text((assay.net_sellable || 0).toFixed(2) + " g");
		$("#wbs-customer").val(sale.customer || "");
		$("#wbs-id-number").val(sale.customer_id_number || "");

		const body = $("#wbs-table-body");
		body.empty();

		if (sale.locked_rates && sale.locked_rates.length) {
			sale.locked_rates.forEach((r) => {
				body.append(createLockedRateRow(r));
			});
		} else {
			body.append(createLockedRateRow());
		}

		updateSaleState();
	})();

	// --------------------------------------------------
	// ROW BUILDER
	// --------------------------------------------------
	function createLockedRateRow(data = {}) {
		return `
			<div class="wbs-table-row">
				<input class="wbs-input" value="${data.price_per_xau || ""}" />
				<input class="wbs-input" value="${data.xau_weight || ""}" />
				<div class="wbs-amount">RM ${(data.amount || 0).toFixed(2)}</div>
				<input class="wbs-input" placeholder="Optional remark" value="${data.remark || ""}" />
				<div class="wbs-trash">🗑</div>
			</div>
		`;
	}

	// --------------------------------------------------
	// PARSE LOCKED RATE TABLE
	// --------------------------------------------------
	function getLockedRates() {
		const rows = [];

		$(".wbs-table-row").each(function () {
			const price = parseFloat($(this).find("input").eq(0).val()) || 0;
			const xauWeight = parseFloat($(this).find("input").eq(1).val()) || 0;
			const remark = $(this).find("input").eq(2).val() || "";

			const amount = price * xauWeight;

			$(this)
				.find(".wbs-amount")
				.text("RM " + amount.toFixed(2));

			rows.push({
				price_per_xau: price,
				xau_weight: xauWeight,
				amount: amount,
				remark: remark,
			});
		});

		return rows;
	}

	// --------------------------------------------------
	// SUMMARY CALCULATION
	// --------------------------------------------------
	function computeSummary(lockedRates) {
		let totalXau = 0;
		let totalRevenue = 0;

		lockedRates.forEach((r) => {
			totalXau += r.xau_weight;
			totalRevenue += r.amount;
		});

		return {
			totalXau,
			totalRevenue,
			weightedAvgRate: totalXau ? totalRevenue / totalXau : 0,
		};
	}

	// --------------------------------------------------
	// UPDATE STATE + UI
	// --------------------------------------------------
	function updateSaleState() {
		const lockedRates = getLockedRates();
		const summary = computeSummary(lockedRates);
		const netXau = state.assay?.net_sellable || 0;
		const customer = $("#wbs-customer").val() || "";
		const idNumber = $("#wbs-id-number").val() || "";

		state.sale = {
			customer: customer,
			customer_id_number: idNumber,
			net_weight: netXau,
			assay_purity: state.assay?.assay_purity || 0,
			net_xau: netXau,
			total_xau_sold: summary.totalXau,
			total_revenue: summary.totalRevenue,
			weighted_avg_rate: summary.weightedAvgRate,
			locked_rates: lockedRates,
		};

		$("#wbs-total-xau").text(summary.totalXau.toFixed(2) + " g");
		$("#wbs-total-amount").text(
			"RM " +
				summary.totalRevenue.toLocaleString("en-MY", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})
		);

		$("#wbs-summary-xau").text(summary.totalXau.toFixed(2) + " g");
		$("#wbs-summary-revenue").text(
			"RM " +
				summary.totalRevenue.toLocaleString("en-MY", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})
		);
		$("#wbs-summary-rate").text(summary.weightedAvgRate.toFixed(2));

		const roundedTableXAU = Number(summary.totalXau.toFixed(2));
		const roundedNetXAU = Number(netXau.toFixed(2));

		if (roundedTableXAU !== roundedNetXAU) {
			$(".wbs-warning")
				.show()
				.html(
					`⚠ Mismatch: Table shows <b>${roundedTableXAU.toFixed(
						2
					)} g</b> but Net XAU is <b>${roundedNetXAU.toFixed(2)} g</b>`
				);
		} else {
			$(".wbs-warning").hide();
		}
	}

	// 🔵 Expose a helper to set customer & id and sync state
	window.WBM_set_selected_customer = function (customer_id, customer_name, id_number) {
		$("#wbs-customer").val(customer_name);
		$("#wbs-id-number").val(id_number || "");

		// Make sure state.sale exists and uses the correct id + id_number
		state.sale = state.sale || {};
		state.sale.customer = customer_id;
		state.sale.customer_name = customer_name;
		state.sale.customer_id_number = id_number || "";

		// Recompute summary and keep state consistent
		updateSaleState();
	};

	// --------------------------------------------------
	// EVENTS
	// --------------------------------------------------
	$(document).on("input", ".wbs-table-row input", updateSaleState);

	$(document).on("click", ".wbs-trash", function () {
		$(this).closest(".wbs-table-row").remove();
		updateSaleState();
	});
	$(document)
		.off("click", ".wbs-add-btn")
		.on("click", ".wbs-add-btn", function () {
			$("#wbs-table-body").append(createLockedRateRow());
		});

	// Customer Field Flow------------------------------------------------------------------------------------
	$(document).on("input", "#wbs-customer, #wbs-id-number", updateSaleState);

	$(document).ready(function () {
		const $wrap = $(".wbs-customer-wrapper");

		if (!$wrap.find(".wbs-add-customer").length) {
			$wrap.append(`
            <button type="button"
        	class="wbs-add-customer wbd-add-customer-btn"
        	title="Add Customer">
			+
			</button>
        `);
		}
	});

	$(document).on("click", ".wbs-add-customer", function () {
		const dialog = new frappe.ui.Dialog({
			title: "Add New Customer",
			fields: [
				{ label: "Customer Name", fieldname: "customer_name", fieldtype: "Data", reqd: 1 },

				{
					label: "Customer Group",
					fieldname: "customer_group",
					fieldtype: "Select",
					options: ["Wholesale", "Retail", "Individual"],
					default: "Wholesale",
					reqd: 1,
				},

				{
					label: "Nationality",
					fieldname: "customer_nationality",
					fieldtype: "Select",
					options: ["Malaysian", "Others"],
					default: "Malaysian",
					reqd: 1,
				},

				{ label: "Malaysian ID", fieldname: "malaysian_id", fieldtype: "Data" },
				{ label: "Other ID Type", fieldname: "other_id_type", fieldtype: "Data" },
				{ label: "Other ID Number", fieldname: "other_id_number", fieldtype: "Data" },

				{ label: "Mobile Number", fieldname: "mobile_number", fieldtype: "Data", reqd: 1 },
				{
					label: "Mobile Number NA",
					fieldname: "mobile_number_na",
					fieldtype: "Check",
					default: 0,
				},
			],

			primary_action_label: "Save Customer",

			primary_action: async (values) => {
				// ---------------- VALIDATION ----------------

				if (!values.customer_name) {
					frappe.msgprint("Customer name is required.");
					return;
				}

				// Malaysian ID logic
				if (values.customer_nationality === "Malaysian") {
					let digits = (values.malaysian_id || "").replace(/\D/g, "");
					if (digits && digits.length !== 12) {
						frappe.msgprint("Malaysian ID must be exactly 12 digits.");
						return;
					}
					if (digits) {
						values.malaysian_id = `${digits.slice(0, 6)}-${digits.slice(
							6,
							8
						)}-${digits.slice(8)}`;
					}
				}

				// Others nationality validation
				if (values.customer_nationality === "Others" && !values.other_id_number) {
					frappe.msgprint("Nationality ID is required for non-Malaysians.");
					return;
				}

				// Mobile validation
				if (!values.mobile_number_na) {
					let digits = (values.mobile_number || "").replace(/\D/g, "");
					if (!digits || (digits.length !== 10 && digits.length !== 11)) {
						frappe.msgprint(
							"Mobile number must be 10 or 11 digits, or mark Mobile Number NA."
						);
						return;
					}

					values.mobile_number =
						digits.length === 10
							? `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`
							: `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;
				}

				dialog.hide();

				// ---------------- CREATE CUSTOMER ----------------
				try {
					const res = await frappe.call({
						method: "frappe.client.insert",
						args: {
							doc: {
								doctype: "Customer",
								customer_name: values.customer_name,
								customer_group: values.customer_group,
								mobile_number: values.mobile_number || "",
								mobile_number_na: values.mobile_number_na || 0,
								customer_nationality: values.customer_nationality,
								malaysian_id: values.malaysian_id || "",
								other_id_type: values.other_id_type || "",
								other_id_number: values.other_id_number || "",
							},
						},
					});

					const c = res.message;

					// ---------------- UPDATE SALES DETAIL UI ----------------
					$("#wbs-customer").val(c.customer_name).data("customer-id", c.name);

					$("#wbs-id-number").val(c.id_number || "");

					// ---------------- UPDATE STATE ----------------
					WBMState.sale = WBMState.sale || {};
					WBMState.sale.customer = c.name;
					WBMState.sale.customer_name = c.customer_name;
					WBMState.sale.customer_id_number = c.id_number || "";

					frappe.show_alert({ message: "Customer added successfully." });
				} catch (err) {
					console.error(err);
					frappe.msgprint("Error creating customer.");
				}
			},
		});

		// ---------------- UI TOGGLES ----------------
		function toggleNationality() {
			const nationality = dialog.get_value("customer_nationality");

			if (nationality === "Malaysian") {
				dialog.set_df_property("malaysian_id", "reqd", 1);
				dialog.get_field("malaysian_id").$wrapper.show();

				dialog.set_df_property("other_id_type", "reqd", 0);
				dialog.get_field("other_id_type").$wrapper.hide();

				dialog.set_df_property("other_id_number", "reqd", 0);
				dialog.get_field("other_id_number").$wrapper.hide();
			} else {
				dialog.set_df_property("malaysian_id", "reqd", 0);
				dialog.get_field("malaysian_id").$wrapper.hide();

				dialog.get_field("other_id_type").$wrapper.show();
				dialog.get_field("other_id_number").$wrapper.show();

				dialog.set_df_property("other_id_type", "reqd", 1);
				dialog.set_df_property("other_id_number", "reqd", 1);
			}
		}

		const midField = dialog.get_field("malaysian_id");
		if (midField && midField.$input) {
			midField.$input.on("blur", () => {
				let val = midField.$input.val() || "";
				let digits = val.replace(/\D/g, "");

				if (!digits) return;

				if (digits.length !== 12) {
					frappe.msgprint("Malaysian ID must be exactly 12 digits.");
					return;
				}

				dialog.set_value(
					"malaysian_id",
					`${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
				);
			});
		}

		const mobileField = dialog.get_field("mobile_number");
		if (mobileField && mobileField.$input) {
			mobileField.$input.on("blur", () => {
				if (dialog.get_value("mobile_number_na")) return;

				let val = mobileField.$input.val() || "";
				let digits = val.replace(/\D/g, "");

				if (!digits) return;

				if (digits.length !== 10 && digits.length !== 11) {
					frappe.msgprint("Mobile number must be 10 or 11 digits.");
					return;
				}

				const formatted =
					digits.length === 10
						? `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`
						: `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;

				dialog.set_value("mobile_number", formatted);
			});
		}
		const mobileNAField = dialog.get_field("mobile_number_na");
		if (mobileNAField && mobileNAField.$input) {
			mobileNAField.$input.on("change", () => {
				const isNA = dialog.get_value("mobile_number_na");
				dialog.set_df_property("mobile_number", "reqd", isNA ? 0 : 1);
				if (isNA) dialog.set_value("mobile_number", "");
			});
		}

		dialog.fields_dict.customer_nationality.$input.on("change", toggleNationality);
		setTimeout(toggleNationality, 150);

		dialog.show();
	});
};

// --------------------------------------------------
// CUSTOMER SEARCH + SELECT LOGIC (ADDED CLEANLY)
// --------------------------------------------------

window.WBS_ALL_CUSTOMERS = window.WBS_ALL_CUSTOMERS || [];
window.WBS_SELECTED_CUSTOMER_ID = window.WBS_SELECTED_CUSTOMER_ID || null;

// Load customers once
frappe.call({
	method: "frappe.client.get_list",
	args: {
		doctype: "Customer",
		fields: ["name", "customer_name", "id_number"],
		limit_page_length: 500,
	},
	callback: function (r) {
		WBS_ALL_CUSTOMERS = r.message || [];
	},
});

// Search customers
$(document).on("input", "#wbs-customer", function () {
	const query = $(this).val().toLowerCase().trim();
	const $list = $("#wbs-customer-suggestions");

	if (!query) {
		$list.hide();
		return;
	}

	const matches = WBS_ALL_CUSTOMERS.filter((c) =>
		(c.customer_name || "").toLowerCase().includes(query)
	).slice(0, 10);

	$list.empty();

	if (!matches.length) {
		$list.append(`<div>No customers found</div>`).show();
		return;
	}

	matches.forEach((c) => {
		$list.append(`
            <div data-id="${c.name}"
                 data-name="${c.customer_name}"
                 data-idnum="${c.id_number || ""}">
                ${c.customer_name}
                ${c.id_number ? " - " + c.id_number : ""}
            </div>
        `);
	});

	$list.show();
});

// Select customer
$(document).on("click", "#wbs-customer-suggestions div", function () {
	const name = $(this).data("name");
	const id = $(this).data("id");
	const idnum = $(this).data("idnum");

	WBS_SELECTED_CUSTOMER_ID = id;
	$("#wbs-customer-suggestions").hide();

	if (window.WBM_set_selected_customer) {
		window.WBM_set_selected_customer(id, name, idnum || "");
	} else {
		// Fallback: at least set fields
		$("#wbs-customer").val(name);
		$("#wbs-id-number").val(idnum || "");
	}
});

// Hide dropdown
$(document).on("blur", "#wbs-customer", function () {
	setTimeout(() => $("#wbs-customer-suggestions").hide(), 150);
});
