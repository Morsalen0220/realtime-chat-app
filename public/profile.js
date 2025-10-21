document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (userId) {
        fetchUserProfile(userId);
    } else {
        console.error('User ID not found in URL.');
    }
});

async function fetchUserProfile(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();

        if (response.ok) {
            document.getElementById('profilePageAvatar').src = user.avatar || 'avatars/avatar1.png';
            document.getElementById('profilePageUsername').textContent = user.username;
            document.getElementById('profilePageBio').textContent = user.status || 'No bio available.';
            // Placeholder values for stats
            document.getElementById('friendsCount').textContent = Math.floor(Math.random() * 100);
            document.getElementById('photosCount').textContent = Math.floor(Math.random() * 50);
            document.getElementById('commentsCount').textContent = Math.floor(Math.random() * 20);
        } else {
            console.error('Failed to fetch user profile:', user.message);
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}
