
<%* 

let bibleName = "AELF";

let regexBible = new RegExp(`Bible\/${bibleName}\/${bibleName}.md$`);

let bible = [...app.vault.getMarkdownFiles().filter(file => file.path.match(regexBible))][0].basename;

let regexBook = new RegExp(`Bible\/${bible}\/Livres\/[^\/]+\/[^\/]+`);

book = (await tp.system.suggester((item) => "📜 "+item.basename, app.vault.getMarkdownFiles().filter(file => file.path.match(regexBook)), false, "📜 Chose the book to quote"));

let regexVerse = new RegExp(`###### ([0-9]{0,3}[^ ]{0,2})[\r?\n](.{0,70})`,'g');

let bookText = String(await app.vault.read(book));

let verseInit = (await tp.system.suggester((item) => item[1]+" "+item[2]+" ...", [...bookText.matchAll(regexVerse)],false,"🎬 Chose the first verse"))[1];

let verseEnd = (await tp.system.suggester((item) => item[1]+" "+item[2]+" ...", [...bookText.matchAll(regexVerse)].filter(item => Number(item[1].replace(/[a-zA-Z]/,''))>=Number(verseInit.replace(/[a-zA-Z]/,''))),false,"🏁 Chose the last verse"))[1];

var standardRegex = "/"+bibleName+"/";
var bibleStandard = new RegExp(standardRegex);

if (bibleStandard.test(book.path)) {
	var bookName = book.basename;
} else {
	var bookName = book.basename.replace(/^[^\ ]+\ /g,'');
}

if (verseInit == undefined || verseInit == null) {
	return;
} else if (verseInit == verseEnd) {
	return "[["+book.basename+"#"+verseInit+"]] ";
} else {
	return "[["+book.basename+"#"+verseInit+"#"+verseEnd+"]] ";
}

%>