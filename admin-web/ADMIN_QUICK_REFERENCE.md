# Admin Panel - Quick Reference

## 🔐 Login
**URL**: `/login`  
**Credentials**: Your admin email + password  
**Role Required**: ADMIN

---

## 📊 Dashboard
**URL**: `/dashboard`

**What you see:**
- Total vendors, pending approvals, orders, revenue
- Revenue chart (last 30 days)
- Recent orders
- Recent vendors

**Quick Actions:**
- View recent activity
- Monitor key metrics

---

## 📦 Orders
**URL**: `/orders`

**Common Tasks:**

### View Orders
1. Go to Orders page
2. Use filters (status, search)
3. Click "View Details" on any order

### Issue Refund
1. Go to Orders → Select order
2. Click "Issue Refund"
3. Enter amount (optional) and reason
4. Enter 2FA code if prompted
5. Confirm

**Note**: Duplicate refunds are prevented (409 error)

### Complete Order
1. Go to Orders → Select order
2. Click "Mark as Delivered"
3. Confirm

---

## 🏪 Vendors
**URL**: `/vendors`

**Common Tasks:**

### Approve Vendor
1. Go to Vendors page
2. Filter by "Pending"
3. Click "Approve" on vendor
4. Confirm

### Reject Vendor
1. Go to Vendors page
2. Filter by "Pending"
3. Click "Reject" on vendor
4. Confirm

### Suspend Vendor
1. Go to Vendors page
2. Find active vendor
3. Click "Suspend"
4. Enter 2FA code if prompted
5. Confirm

### Unsuspend Vendor
1. Go to Vendors page
2. Filter by "Suspended"
3. Click "Unsuspend"
4. Confirm

---

## 👥 Users
**URL**: `/users`

**Common Tasks:**

### View Users
1. Go to Users page
2. Filter by role (BUYER, VENDOR, ADMIN)
3. View user details

**Note**: User suspension is handled through vendor suspension

---

## 🛍️ Products
**URL**: `/products`

**Common Tasks:**

### View Products
1. Go to Products page
2. Filter by status (active, disabled)
3. View product details

---

## ✅ Verification
**URL**: `/verification`

**Common Tasks:**

### Review Documents
1. Go to Verification page
2. Filter by "Pending"
3. Click "Review" on document
4. Click "View File" to see document
5. Add optional note
6. Click "Approve" or "Reject"
7. Enter 2FA code if prompted

**Document Types:**
- ID verification
- Business registration
- Selfie verification

---

## ⚖️ Disputes
**URL**: `/disputes`

**Common Tasks:**

### View Disputes
1. Go to Disputes page
2. Click "View Details" on dispute
3. Review order and reason

### Resolve Dispute
1. View dispute details
2. Click resolve action
3. Enter resolution details
4. Enter 2FA code if prompted
5. Confirm

---

## 📈 Analytics
**URL**: `/analytics`

**What you see:**
- Total revenue
- Total orders
- Average order value
- Dispute rate
- Revenue trend chart (7d, 30d, 90d)
- Top vendors

**Quick Actions:**
- Change date range
- View top performers

---

## 💰 Refunds
**URL**: `/refunds`

**Note**: Refunds are issued from Order Detail page

**Process:**
1. Go to Orders
2. Select order
3. Click "Issue Refund"

---

## ⚙️ Settings
**URL**: `/settings`

**What you see:**
- Your account info
- API connection status
- 2FA information
- App version

**Quick Actions:**
- Check API status
- View 2FA requirements

---

## 🔒 2FA (Two-Factor Authentication)

**When Required:**
- Issuing refunds
- Resolving disputes
- Reviewing verification documents
- Suspending vendors (if backend requires)

**How it Works:**
1. Perform sensitive action
2. Modal appears asking for 2FA code
3. Enter 6-digit code from authenticator app
4. Action proceeds

**Tip**: Keep your authenticator app ready

---

## 🚨 Common Errors

### "Unauthorized" (401)
- **Cause**: Token expired or invalid
- **Fix**: You'll be auto-redirected to login

### "Forbidden" (403)
- **Cause**: Not admin role OR 2FA required
- **Fix**: Check role or enter 2FA code

### "Conflict" (409)
- **Cause**: Duplicate action (e.g., refund already issued)
- **Fix**: Refresh page to see current state

### "Not Found" (404)
- **Cause**: Resource doesn't exist
- **Fix**: Check ID or go back

---

## 💡 Tips

1. **Use Filters** - Save time by filtering lists
2. **Search** - Use search on orders and vendors
3. **Confirm Actions** - Always double-check before confirming
4. **2FA Ready** - Keep authenticator app accessible
5. **Refresh Data** - Use retry buttons if data fails to load
6. **Check Status** - Monitor API status in Settings

---

## 🆘 Troubleshooting

### Can't Login
- Verify you have ADMIN role
- Check credentials
- Verify backend API is running

### Data Not Loading
- Check API status in Settings
- Click retry button
- Check browser console for errors

### Action Failed
- Read error message
- Check if 2FA is required
- Verify you have permission
- Try again

---

## 📱 Mobile Use

The panel is responsive but optimized for desktop use.

**Mobile Tips:**
- Use hamburger menu (☰) to access sidebar
- Scroll tables horizontally
- Portrait mode recommended

---

## 🔐 Security Best Practices

1. **Never share** admin credentials
2. **Always logout** when finished
3. **Use strong password** for admin account
4. **Enable 2FA** on your account
5. **Report suspicious** activity immediately
6. **Keep credentials** in secure password manager

---

## 📞 Need Help?

1. Check README.md
2. Review ADMIN_WEB_PANEL_REPORT.md
3. Follow DEPLOYMENT_GUIDE.md
4. Contact technical support

---

**Quick Reference Version**: 1.0  
**Last Updated**: May 31, 2026
