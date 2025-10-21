
from playwright.sync_api import Page, expect

def verify_profile_page(page: Page):
    print("Running verification script...")
    # Navigate to the home page
    page.goto("http://localhost:3000")

    # Click the guest button
    page.click("#guestBtn")

    # Click the profile link
    page.click("#user-profile-info")

    # Check that the profile page is loaded
    page.wait_for_load_state()
    expect(page).to_have_url("http://localhost:3000/profile?id=guest-12345")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")
