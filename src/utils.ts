export default class Utils {
    static getHeightShade(height: number, maxHeight: number) {
        const MIN_RGB = 64, MAX_RGB = 192;
        const clr = MIN_RGB + (height/maxHeight)*(MAX_RGB-MIN_RGB);
        return `rgb(${clr}, 0, ${MAX_RGB-clr})`;
    }
    static getMaxHeight(heights: number[][]) { return Math.max(...heights.map(row => Math.max(...row))); }
    static getMinHeight(heights: number[][]) { return Math.min(...heights.map(row => Math.min(...row))); }
    static getRandom(min: number, max: number) { return Math.round(min + Math.random()*(max-min)); }
}