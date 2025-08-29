app_name = "gold_app"
app_title = "Gold App"
app_publisher = "Mradul"
app_description = "Erpnext Gold"
app_email = "mishramradul29@gmail.com"
app_license = "mit"


fixtures = [
    {"dt": "Custom Field", "filters": [["module", "=", "Gold App"]]},
    {"dt": "Property Setter", "filters": [["module", "=", "Gold App"]]}
]


doctype_js = {
    "Sales Invoice": "public/js/sales_invoice_item.js",
    "Purchase Invoice": "public/js/purchase_invoice_item.js",
    "Sales Order": "public/js/sales_order_item.js",
    "Purchase Order": "public/js/purchase_order_item.js",
    "Stock Entry": "public/js/stock_entry.js",
    "Purchase Receipt": "public/js/purchase_receipt.js",
}

doc_events = {
    "Item": {
        "autoname": "gold_app.api.item.autoname",
        "on_update": "gold_app.gold_app.doctype.purity.purity.item_update_handler"
    },
    "Sales Order": {
        "before_save": "gold_app.api.custom_time_auto_fill.set_order_time"
    },
    "Purchase Order": {
        "before_save": "gold_app.api.custom_time_auto_fill.set_order_time"
    },
    "Sales Invoice": {
        "before_save": "gold_app.api.custom_time_auto_fill.set_order_time"
    },
    "Purchase Invoice": {
        "before_save": "gold_app.api.custom_time_auto_fill.set_order_time"
    },
    "Item Group": {
        "before_save": "gold_app.api.item.set_item_group_prefix"
    },
    "Stock Entry": {
        "validate": [
            "gold_app.api.stock_entry.validate_break_item_qty",
        ],
        "on_submit": "gold_app.api.stock_entry.create_material_issue"
    },
    "Purchase Receipt": {
        "before_submit": "gold_app.gold_app.doctype.item_pickup.item_pickup.create_item_pickups",
        "on_submit": [
        "gold_app.api.purchase_receipt.update_item_from_receipt",
        # "gold_app.api.purchase_receipt.create_invoice_and_payment"
    ]
    },
    "Item Pickup": {
        "validate": "gold_app.gold_app.doctype.item_pickup.item_pickup.validate"
    }
}



# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "gold_app",
# 		"logo": "/assets/gold_app/logo.png",
# 		"title": "Gold App",
# 		"route": "/gold_app",
# 		"has_permission": "gold_app.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/gold_app/css/gold_app.css"
# app_include_js = "/assets/gold_app/js/gold_app.js"

# include js, css files in header of web template
# web_include_css = "/assets/gold_app/css/gold_app.css"
# web_include_js = "/assets/gold_app/js/gold_app.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "gold_app/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "gold_app/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "gold_app.utils.jinja_methods",
# 	"filters": "gold_app.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "gold_app.install.before_install"
# after_install = "gold_app.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "gold_app.uninstall.before_uninstall"
# after_uninstall = "gold_app.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "gold_app.utils.before_app_install"
# after_app_install = "gold_app.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "gold_app.utils.before_app_uninstall"
# after_app_uninstall = "gold_app.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "gold_app.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events




# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"gold_app.tasks.all"
# 	],
# 	"daily": [
# 		"gold_app.tasks.daily"
# 	],
# 	"hourly": [
# 		"gold_app.tasks.hourly"
# 	],
# 	"weekly": [
# 		"gold_app.tasks.weekly"
# 	],
# 	"monthly": [
# 		"gold_app.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "gold_app.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "gold_app.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "gold_app.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["gold_app.utils.before_request"]
# after_request = ["gold_app.utils.after_request"]

# Job Events
# ----------
# before_job = ["gold_app.utils.before_job"]
# after_job = ["gold_app.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"gold_app.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

