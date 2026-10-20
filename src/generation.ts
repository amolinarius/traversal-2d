import Utils from "./utils";

export default function generateHeights() {
    const size = 10;
    const heights = Array.from({ length: size }, () => Array<number>(size).fill(0));
    const landscapeFactor = 0.5; // Medium Woodlands
    const pushCount = 150;

    const getAllowedHeight = (x: number, y: number) => {
        const distanceToEdge = Math.min(x+1, y+1, size-x, size-y);
        return { min: distanceToEdge * -2, max: distanceToEdge * 2 };
    };
    const isValidHeight = (x: number, y: number) => {
        const { min, max } = getAllowedHeight(x, y);
        const height = heights[y][x];
        if (height < min || height > max) return false;

        const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        return neighbors.every(([neighborX, neighborY]) => {
            if (neighborX < 0 || neighborX >= size || neighborY < 0 || neighborY >= size) return true;
            return Math.abs(height - heights[neighborY][neighborX]) <= 2;
        });
    };
    const scramble = (start: number, end: number) => {
        let acceptedPushes = 0;
        while (acceptedPushes < pushCount) {
            const x = Utils.getRandom(start, end - 1);
            const y = Utils.getRandom(start, end - 1);
            const direction = Math.random() >= landscapeFactor ? 1 : -1;
            heights[y][x] += direction;

            if (isValidHeight(x, y)) acceptedPushes++;
            else heights[y][x] -= direction;
        }
    };

    scramble(0, 10);
    scramble(1, 9);
    scramble(2, 8);
    scramble(3, 7);

    const minimumHeight = Utils.getMinHeight(heights);
    return heights.map(row => row.map(height => height - minimumHeight));
}