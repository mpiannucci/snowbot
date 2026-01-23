import { createTheme, MantineColorsTuple } from "@mantine/core";

const purple: MantineColorsTuple = [
	"#faf5ff",
	"#f2e7ff",
	"#e8d3ff",
	"#d6b0ff",
	"#bc7eff",
	"#A653FF",
	"#8d2af3",
	"#791ad6",
	"#681aaf",
	"#56178c",
];

const gray: MantineColorsTuple = [
	"#F5F5F5",
	"#f0f0f0",
	"#e4e4e4",
	"#d1d1d1",
	"#b4b4b4",
	"#9a9a9a",
	"#818181",
	"#6a6a6a",
	"#5a5a5a",
	"#4e4e4e",
];

const slate: MantineColorsTuple = [
	"#ececf2",
	"#d4d4e3",
	"#afafca",
	"#8384ad",
	"#646493",
	"#504f7a",
	"#424163",
	"#393854",
	"#333248",
	"#201f2C",
];

const lime: MantineColorsTuple = [
	"#fdffe4",
	"#f9ffc5",
	"#f2ff92",
	"#e5ff53",
	"#d3fb20",
	"#B7e400",
	"#8cb500",
	"#6a8902",
	"#546c08",
	"#475b0c",
];

const red: MantineColorsTuple = [
	"#fff2f0",
	"#ffd9d4",
	"#ffb3a8",
	"#ff8a7c",
	"#FF6554",
	"#e54b39",
	"#cc3524",
	"#b32515",
	"#99180c",
	"#801006",
];

const orange: MantineColorsTuple = [
	"#fff8eb",
	"#ffe8c7",
	"#ffd494",
	"#ffbc61",
	"#ffa52e",
	"#FF9E0D",
	"#cc7e0a",
	"#996008",
	"#664006",
	"#331f03",
];

const green: MantineColorsTuple = [
	"#ebfff7",
	"#d0ffeb",
	"#a8ffdb",
	"#74ffc7",
	"#31D495",
	"#26b37d",
	"#1c9366",
	"#147350",
	"#0d533a",
	"#073323",
];

const blue: MantineColorsTuple = [
	"#f0f9ff",
	"#d6eeff",
	"#b0dfff",
	"#85cfff",
	"#5EC4F7",
	"#3ea6d9",
	"#2a89bb",
	"#1c6c9d",
	"#12507f",
	"#0a3561",
];

const pink: MantineColorsTuple = [
	"#fff0f9",
	"#ffd9ee",
	"#ffb3de",
	"#ff8ccd",
	"#F881D1",
	"#d968b3",
	"#b95096",
	"#993c7a",
	"#7a295e",
	"#5a1942",
];

export default createTheme({
	fontFamily:
		'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
	headings: {
		fontWeight: "300",
		sizes: {
			h1: { fontSize: "1.953rem", lineHeight: "1.3", fontWeight: undefined },
			h2: { fontSize: "1.563rem", lineHeight: "1.35", fontWeight: undefined },
			h3: { fontSize: "1.25rem", lineHeight: "1.4", fontWeight: undefined },
			h4: { fontSize: "1rem", lineHeight: "1.45", fontWeight: "bold" },
			h5: { fontSize: "0.8rem", lineHeight: "1.5", fontWeight: "bold" },
			h6: { fontSize: "0.64rem", lineHeight: "1.5", fontWeight: "bold" },
		},
	},
	colors: {
		purple,
		gray,
		slate,
		lime,
		red,
		orange,
		green,
		blue,
		pink,
	},
	primaryColor: "purple",
	primaryShade: 5,
});
