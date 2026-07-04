export const buildSteamImageUrl = (image: string | null | undefined, size = '160fx160f') => {
    if (!image) return null
    if (/^https?:\/\//i.test(image)) return image
    return `https://steamcommunity-a.akamaihd.net/economy/image/${image}/${size}`
}
