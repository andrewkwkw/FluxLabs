export const generateThumbnail = async (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.crossOrigin = 'anonymous'; // Important for CORS if video is on a different domain
        video.preload = 'metadata'; // Load only metadata initially

        video.onloadedmetadata = () => {
            video.currentTime = video.duration / 2; // Seek to the middle of the video
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); // Resolve with JPEG data URL
            } else {
                reject(new Error('Could not get canvas context'));
            }
            video.remove(); // Clean up the video element
        };

        video.onerror = (e) => {
            console.error('Error loading video for thumbnail generation:', e);
            reject(new Error('Failed to load video for thumbnail generation.'));
            video.remove();
        };

        // If metadata doesn't load for some reason, ensure cleanup
        setTimeout(() => {
            if (!video.readyState) {
                console.warn('Video metadata did not load within expected time for thumbnail generation.');
                reject(new Error('Video metadata load timeout.'));
                video.remove();
            }
        }, 10000); // 10 second timeout
    });
};