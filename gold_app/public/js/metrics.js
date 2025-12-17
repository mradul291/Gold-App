window.WBMComponents = window.WBMComponents || {};

window.WBMComponents.metrics = function ($mount, state) {
	const html = `
	<div class="wmt-root">

		<div class="wmt-title">Transaction Metrics</div>

		<!-- WEIGHT & PURITY ANALYSIS -->
		<div class="wmt-card">
			<div class="wmt-card-header">WEIGHT & PURITY ANALYSIS</div>

			<div class="wmt-two-col">
				<div class="wmt-col">
					<div class="wmt-row"><div class="wmt-label">Original Gross Weight</div><div class="wmt-value" id="m_gross_weight">—</div></div>
					<div class="wmt-row"><div class="wmt-label">Weight Loss</div><div class="wmt-value wmt-negative" id="m_weight_loss">—</div></div>
					<div class="wmt-row"><div class="wmt-label">XAU Weight Loss</div><div class="wmt-value wmt-negative" id="m_xau_loss">—</div></div>

					<div class="wmt-divider"></div>

					<div class="wmt-row"><div class="wmt-label">Original Avg Purity</div><div class="wmt-value" id="m_avg_purity">—</div></div>
					<div class="wmt-row"><div class="wmt-label">Purity Variance</div><div class="wmt-value wmt-negative" id="m_purity_variance">—</div></div>
				</div>

				<div class="wmt-col">
					<div class="wmt-row"><div class="wmt-label">Weight After Melting</div><div class="wmt-value" id="m_after_melting">—</div></div>
					<div class="wmt-row"><div class="wmt-label">Weight Loss %</div><div class="wmt-value wmt-negative" id="m_weight_loss_pct">—</div></div>
					<div class="wmt-row"><div class="wmt-label">Net Weight For Sale</div><div class="wmt-value" id="m_net_weight">—</div></div>

					<div class="wmt-divider"></div>

					<div class="wmt-row"><div class="wmt-label">Assay Purity</div><div class="wmt-value" id="m_assay_purity">—</div></div>
					<div class="wmt-row"><div class="wmt-label">XAU Weight Variance</div><div class="wmt-value wmt-negative" id="m_xau_variance">—</div></div>
				</div>
			</div>
		</div>

		<!-- COST + PROFIT -->
		<div class="wmt-bottom-grid">
			<div class="wmt-card">
				<div class="wmt-card-header">COST ANALYSIS</div>
				<div class="wmt-row"><div class="wmt-label">Original Gold Cost</div><div class="wmt-value" id="m_original_cost">—</div></div>
				<div class="wmt-row"><div class="wmt-label">Melting Cost</div><div class="wmt-value" id="m_melting_cost">—</div></div>
				<div class="wmt-row"><div class="wmt-label">Assay Cost</div><div class="wmt-value" id="m_assay_cost">—</div></div>

				<div class="wmt-divider"></div>

				<div class="wmt-row wmt-total-row"><div class="wmt-label">Total Cost</div><div class="wmt-value" id="m_total_cost">—</div></div>
			</div>

			<div class="wmt-card wmt-profit-card">
				<div class="wmt-card-header">REVENUE & PROFIT</div>
				<div class="wmt-row"><div class="wmt-label">Total Revenue</div><div class="wmt-value" id="m_revenue">—</div></div>
				<div class="wmt-row"><div class="wmt-label">Total Cost</div><div class="wmt-value" id="m_total_cost_2">—</div></div>

				<div class="wmt-divider"></div>

				<div class="wmt-row wmt-profit-row"><div class="wmt-label">Gross Profit</div><div class="wmt-profit-value" id="m_profit">—</div></div>
				<div class="wmt-row"><div class="wmt-label">Profit Margin</div><div class="wmt-profit-percent" id="m_profit_margin">—</div></div>
			</div>
		</div>

		<!-- PROCESS EFFICIENCY -->
		<div class="wmt-card">
			<div class="wmt-card-header">PROCESS EFFICIENCY</div>

			<div class="wmt-efficiency-grid">
				<div class="wmt-eff-card"><div class="wmt-eff-label">Melting Efficiency</div><div class="wmt-eff-value" id="m_eff_melting">—</div></div>
				<div class="wmt-eff-card wmt-eff-green"><div class="wmt-eff-label">XAU Recovery</div><div class="wmt-eff-value" id="m_eff_xau">—</div></div>
				<div class="wmt-eff-card wmt-eff-blue"><div class="wmt-eff-label">Net Sellable</div><div class="wmt-eff-value" id="m_eff_net">—</div></div>
				<div class="wmt-eff-card wmt-eff-purple"><div class="wmt-eff-label">Profit per XAU</div><div class="wmt-eff-value" id="m_profit_xau">—</div></div>
			</div>
			</div>

			<!-- VS LAST SALE -->
	<div class="wmt-card">
		<div class="wmt-card-header">VS LAST SALE</div>

		<div class="wmt-row">
			<div class="wmt-label">Weight Loss %</div>
			<div class="wmt-value" id="vs_weight_loss_pct">—</div>
		</div>

		<div class="wmt-row">
			<div class="wmt-label">XAU Recovery Rate %</div>
			<div class="wmt-value" id="vs_xau_recovery">—</div>
		</div>

		<div class="wmt-row">
			<div class="wmt-label">Purity Variance %</div>
			<div class="wmt-value" id="vs_purity_variance">—</div>
		</div>

		<div class="wmt-row">
			<div class="wmt-label">Net Sellable %</div>
			<div class="wmt-value" id="vs_net_sellable">—</div>
		</div>

		<div class="wmt-row">
			<div class="wmt-label">Profit Margin %</div>
			<div class="wmt-value" id="vs_profit_margin">—</div>
		</div>
	</div>

	</div>
	`;

	$mount.html(html);

	// --------------------------------------------------
	// COMPUTE METRICS EVERY TIME TAB LOADS
	// --------------------------------------------------
	(function computeMetrics() {
		const s = state.bag_summary || {};
		const melt = state.melting || {};
		const assay = state.assay || {};
		const sale = state.sale || {};

		// BAG SUMMARY
		const grossWeight = s.total_weight_g || 0;
		const avgPurity = s.average_purity || 0;
		const originalGoldCost = s.total_cost_basis || 0;

		// MELTING
		const afterMelting = melt.after || 0;
		const weightLoss = melt.weight_loss || 0;
		const xauLoss = melt.xau_loss || 0;
		const weightLossPct = melt.loss_percentage || 0;

		// ASSAY
		const assayPurity = assay.assay_purity || 0;
		const purityVariance = assay.purity_variance || 0;
		const xauVariance = assay.xau_weight_variance || 0;

		const sampleWeight = assay.assay_sample_weight || 0;
		const netWeightSale = afterMelting - sampleWeight;
		const netSellableXau = assay.net_sellable || 0;

		// COST
		const meltingCost = melt.cost || 0;
		const assayCost = assay.cost || 0;
		const totalCost = originalGoldCost + meltingCost + assayCost;

		// REVENUE
		const revenue = sale.total_revenue || 0;
		const grossProfit = revenue - totalCost;
		const profitMargin = revenue ? (grossProfit / revenue) * 100 : 0;

		// EFFICIENCY
		const meltingEfficiency = grossWeight ? (afterMelting / grossWeight) * 100 : 0;

		const xauRecovery = s.pure_gold_xau_g ? (netSellableXau / s.pure_gold_xau_g) * 100 : 0;

		const netSellablePct = grossWeight ? (netWeightSale / grossWeight) * 100 : 0;

		const profitPerXau = netSellableXau ? grossProfit / netSellableXau : 0;

		// ------------------------------------
		// VS LAST SALE (DIFF ONLY)
		// ------------------------------------
		const last = state.last_sale_metrics || {};

		const vsWeightLoss = (weightLossPct || 0) - (last.weight_loss_pct || 0);

		const vsXauRecovery = (xauRecovery || 0) - (last.xau_recovery || 0);

		const vsPurityVariance = (purityVariance || 0) - (last.purity_variance || 0);

		const vsNetSellable = (netSellablePct || 0) - (last.net_sellable || 0);

		const vsProfitMargin = (profitMargin || 0) - (last.profit_margin || 0);

		// STORE
		state.metrics = {
			m_original_gross_weight: grossWeight,
			m_weight_after_melting: afterMelting,
			m_weight_loss: weightLoss,
			m_weight_loss_percentage: weightLossPct,
			m_xau_weight_loss: xauLoss,
			m_net_weight_sale: netWeightSale,

			m_original_avg_purity: avgPurity,
			m_assay_purity: assayPurity,
			m_purity_variance: purityVariance,
			m_xau_weight_variance: xauVariance,

			m_original_gold_cost: originalGoldCost,
			m_melting_cost: meltingCost,
			m_assay_cost: assayCost,
			m_total_cost: totalCost,

			m_total_revenue: revenue,
			m_gross_profit: grossProfit,
			m_profit_margin: profitMargin,

			m_melting_efficiency: meltingEfficiency,
			m_xau_recovery: xauRecovery,
			m_net_sellable: netSellablePct,
			m_profit_per_xau: profitPerXau,

			vs_weight_loss_percentage: vsWeightLoss,
			vs_xau_recovery_rate: vsXauRecovery,
			vs_purity_variance: vsPurityVariance,
			vs_net_sellable_percentage: vsNetSellable,
			vs_profit_margin: vsProfitMargin,
		};
	})();

	// --------------------------------------------------
	// HYDRATE METRICS UI FROM STATE
	// --------------------------------------------------
	(function hydrateMetrics() {
		const m = state.metrics || {};

		const rm = (v) =>
			"RM " +
			(v || 0).toLocaleString("en-MY", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});

		$("#m_gross_weight").text((m.m_original_gross_weight || 0).toFixed(2) + " g");
		$("#m_weight_loss").text((m.m_weight_loss || 0).toFixed(2) + " g");
		$("#m_xau_loss").text((m.m_xau_weight_loss || 0).toFixed(2) + " g");
		$("#m_avg_purity").text((m.m_original_avg_purity || 0).toFixed(2) + "%");
		$("#m_purity_variance").text((m.m_purity_variance || 0).toFixed(2) + "%");

		$("#m_after_melting").text((m.m_weight_after_melting || 0).toFixed(2) + " g");
		$("#m_weight_loss_pct").text((m.m_weight_loss_percentage || 0).toFixed(2) + "%");
		$("#m_net_weight").text((m.m_net_weight_sale || 0).toFixed(2) + " g");
		$("#m_assay_purity").text((m.m_assay_purity || 0).toFixed(2) + "%");
		$("#m_xau_variance").text((m.m_xau_weight_variance || 0).toFixed(2) + " g");

		$("#m_original_cost").text(rm(m.m_original_gold_cost));
		$("#m_melting_cost").text(rm(m.m_melting_cost));
		$("#m_assay_cost").text(rm(m.m_assay_cost));
		$("#m_total_cost").text(rm(m.m_total_cost));
		$("#m_total_cost_2").text(rm(m.m_total_cost));

		$("#m_revenue").text(rm(m.m_total_revenue));
		$("#m_profit").text(rm(m.m_gross_profit));
		$("#m_profit_margin").text((m.m_profit_margin || 0).toFixed(2) + "%");

		$("#m_eff_melting").text((m.m_melting_efficiency || 0).toFixed(2) + "%");
		$("#m_eff_xau").text((m.m_xau_recovery || 0).toFixed(2) + "%");
		$("#m_eff_net").text((m.m_net_sellable || 0).toFixed(2) + "%");
		$("#m_profit_xau").text(rm(m.m_profit_per_xau));

		// ------------------------------------
		// VS LAST SALE (UI)
		// ------------------------------------
		function setVsValue(id, val) {
			const $el = $(id);
			const v = Number(val) || 0;

			$el.text(v.toFixed(2) + "%")
				.removeClass("wmt-positive wmt-negative")
				.addClass(v > 0 ? "wmt-positive" : v < 0 ? "wmt-negative" : "");
		}

		// ------------------------------------
		// VS LAST SALE (UI with colors)
		// ------------------------------------
		setVsValue("#vs_weight_loss_pct", m.vs_weight_loss_percentage);
		setVsValue("#vs_xau_recovery", m.vs_xau_recovery_rate);
		setVsValue("#vs_purity_variance", m.vs_purity_variance);
		setVsValue("#vs_net_sellable", m.vs_net_sellable_percentage);
		setVsValue("#vs_profit_margin", m.vs_profit_margin);
	})();
};
