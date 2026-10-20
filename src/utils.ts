export default class Utils {
    static getHeightShade(height: number, maxHeight: number) {
        const lerp = (a: number, b: number, t: number) => a + (b-a)*t;
        const GRADIENT_TYPES = [
            { name: "grayscale", min: 100, max: 255, value: (clr: number) => `rgb(${clr}, ${clr}, ${clr})` },
            { name: "blue-red", min: 64, max: 192, value: (clr: number) => `rgb(${clr}, 0, ${192-clr})` },
            { name: "yellow", min: 10, max: 245, value: (clr: number) => `rgb(${clr}, ${clr}, 0)` },
            { name: "rainbow", min: 10, max: 100, value: (clr: number) => `hsl(${(clr/200)*300}deg, 50%, 50%)` }
        ] as const;
        const gradient = GRADIENT_TYPES.find(g => g.name == "grayscale")!;
        
        const clr = gradient.min + (height/maxHeight)*(gradient.max-gradient.min);
        return gradient.value(clr);
    }
    static getMaxHeight(heights: number[][]) { return Math.max(...heights.map(row => Math.max(...row))); }
    static getMinHeight(heights: number[][]) { return Math.min(...heights.map(row => Math.min(...row))); }
    static getRandom(min: number, max: number) { return Math.round(min + Math.random()*(max-min)); }
}