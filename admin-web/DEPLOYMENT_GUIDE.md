# Admin Web Panel - Deployment Guide

## Quick Start

### Option 1: Vercel (Recommended - 5 minutes)

1. **Push to Git** (if not already)
   ```bash
   git add admin-web/
   git commit -m "Add admin web panel"
   git push
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your repository
   - Set root directory to `admin-web`
   - Add environment variable:
     - `NEXT_PUBLIC_API_URL` = `https://ekiapp-backend.vercel.app/api`
   - Click "Deploy"

3. **Access**
   - Your panel will be live at `https://your-project.vercel.app`
   - Login with admin credentials

### Option 2: Build Locally (requires disk space)

1. **Navigate to project**
   ```bash
   cd admin-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env.local
   ```

4. **Build**
   ```bash
   npm run build
   ```

5. **Start production server**
   ```bash
   npm start
   ```

6. **Access**
   - Open http://localhost:3000
   - Login with admin credentials

## Environment Variables

Required:
```env
NEXT_PUBLIC_API_URL=https://ekiapp-backend.vercel.app/api
```

## Admin Credentials

Use existing admin account from the backend database.

**Test Login:**
- Email: Your admin email
- Password: Your admin password

**Important**: Only users with `role: "ADMIN"` can access the panel.

## Post-Deployment Checklist

- [ ] Admin can login
- [ ] Dashboard loads
- [ ] Orders page works
- [ ] Vendors page works
- [ ] Refund action works
- [ ] 2FA prompts appear for sensitive actions
- [ ] Non-admin users are blocked

## Troubleshooting

### "Unauthorized" error
- Check that `NEXT_PUBLIC_API_URL` is set correctly
- Verify admin credentials
- Check backend API is accessible

### "Forbidden" error
- Verify user has `ADMIN` role in database
- Check JWT token is valid

### Build fails with ENOSPC
- Free up disk space (need ~2GB)
- Or deploy directly to Vercel (no local build needed)

### API connection issues
- Verify backend is running at `https://ekiapp-backend.vercel.app`
- Check CORS settings on backend
- Verify network connectivity

## Support

For issues:
1. Check README.md
2. Review ADMIN_WEB_PANEL_REPORT.md
3. Verify environment variables
4. Check browser console for errors

## Security Notes

- Always use HTTPS in production
- Keep admin credentials secure
- Enable 2FA on admin accounts
- Regularly review access logs
- Never commit .env.local to git

## Monitoring

After deployment, monitor:
- Login success rate
- API response times
- Error rates
- User activity

## Updates

To update the panel:
1. Pull latest code
2. Run `npm install` (if dependencies changed)
3. Run `npm run build`
4. Restart server or redeploy to Vercel

## Backup

Recommended:
- Regular database backups
- Environment variable backups
- Access to admin credentials in secure location

---

**Deployment Time**: ~5 minutes with Vercel  
**Maintenance**: Minimal - static Next.js app  
**Scaling**: Automatic with Vercel
