# Setting Up Test Users in Clerk

## Step 1: Enable Email/Password Authentication in Clerk

1. **Go to Clerk Dashboard**
   - Visit [https://dashboard.clerk.com](https://dashboard.clerk.com)
   - Sign in to your account
   - Select your application

2. **Enable Email/Password Authentication**
   - Go to **User & Authentication** → **Email, Phone, Username**
   - Find the **"Email address"** section
   - Enable **"Email address"** if not already enabled
   - Scroll down to **"Password"** section
   - Enable **"Password"** authentication method
   - Save changes

3. **Configure Authentication Methods** (Optional)
   - You can also enable **"Username"** if you want username-based login
   - Make sure **"Email address"** is enabled (required for password auth)

## Step 2: Create a Test User Account

### Method 1: Create User in Clerk Dashboard (Recommended)

1. **Go to Users Section**
   - In Clerk Dashboard, click **"Users"** in the sidebar
   - Click **"Create user"** button (top right)

2. **Fill in User Details**
   - **Email address**: Enter a test email (e.g., `testuser@example.com`)
   - **Password**: Enter a password (or let Clerk generate one)
   - **First name**: (Optional) e.g., "Test"
   - **Last name**: (Optional) e.g., "User"
   - Click **"Create user"**

3. **Note the User ID**
   - After creating, you'll see the user's details
   - Copy the **User ID** (starts with `user_...`)
   - You'll need this for testing

### Method 2: Create User via Sign-Up Flow

1. **Go to Your Application**
   - Visit your app (e.g., `http://localhost:3000`)
   - Click **"Sign up"** or **"Sign in"**

2. **Create Account**
   - Enter a test email address
   - Enter a password
   - Complete the sign-up process

3. **Get User ID**
   - After signing up, check the browser console
   - Or go to Clerk Dashboard → Users → Find the user by email

## Step 3: Test with the New User

1. **Log Out** from your current account
   - Make sure you're completely logged out

2. **Log In** with the test user
   - Use the email/password you created
   - Verify you're logged in as the test user

3. **Test Group Deletion**
   - Navigate to `/dashboard/sharing`
   - Try to delete a group created by another user
   - Check console logs for security checks

## Step 4: Verify User IDs are Different

To confirm you have different users:

1. **Check Browser Console**
   - Log in as User A
   - Open console, type: `await window.Clerk.user.id`
   - Note the user ID
   
2. **Log Out and Log In as User B**
   - Repeat the console check
   - Verify the user IDs are different

## Troubleshooting

### If Email/Password Option Doesn't Appear:
- Make sure you're on the correct Clerk application
- Check that you have the right permissions
- Try refreshing the dashboard

### If You Can't Create Users:
- Check your Clerk plan limits
- Free tier allows multiple users for testing

### To Delete Test Users Later:
- Go to Clerk Dashboard → Users
- Find the test user
- Click on the user → Click "Delete user"










