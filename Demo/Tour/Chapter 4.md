```button
name 👆 Click if you want to get back to Chapter 3
type command
action Workspaces Plus: Load: Chapter 3.1
```

### Chapter 4 : crawling within major theological works

#### Example work on inspiration

Let's suppose I'm studying Saint Thomas's work about inspiration. I want to study every single time he has used that word. The Latin is a language using declinations, but hopefully the power of regex will help us. Here, it's very simple, as using `/inspira(n)?t*/` will surface any latin word using that same root (inspiratione, inspiratio, inspirantis...)

👈 Here I've typed in the simple below query in my note

````
```query
title: Checking where the latin root inspirat* was used by Saint Thomas in the Summa, and how it was translated in French
path:Texts/SummaTheologiaeStudium /inspira(n)?t*/
```
````

That query is running on the special text "SummaTheologiaeStudium", which is the latin version of the Summa but with a transcluded French translation below each sub-part of each article.

By expanding the results on the left, and then clicking on "show more context" on the bottom right of the result box, I can very quickly see every single time Saint Thomas has used that word, count the number of time he used it, and compare how it has been translated in French.

This is how it should look like 👇

![[Screenshot Work Inspiration.png]]

To do the same thing manually **would litterally take more than one week** !

```button
name Click here to go to the Conclusion 👇
type command
action Workspaces Plus: Load: Conclusion
```
