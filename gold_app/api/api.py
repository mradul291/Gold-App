import frappe

@frappe.whitelist()
def get_staff_users(doctype, txt, searchfield, start, page_len, filters):
    return frappe.db.sql("""
        SELECT u.name, CONCAT(u.first_name, ' ', IFNULL(u.last_name, ''))
        FROM `tabUser` u
        INNER JOIN `tabHas Role` r ON u.name = r.parent
        WHERE r.role = 'Staff'
          AND u.enabled = 1
          AND (u.{key} LIKE %(txt)s 
               OR u.first_name LIKE %(txt)s 
               OR u.last_name LIKE %(txt)s)
        ORDER BY u.first_name
        LIMIT %(start)s, %(page_len)s
    """.format(key=searchfield), {
        "txt": "%" + txt + "%",
        "start": start,
        "page_len": page_len
    })
