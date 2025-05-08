const { chromium } = require('playwright');
const browserUse = require('browser-use');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 2: Automate Medium
    await page.goto('https://medium.com/');
    await page.fill('input[placeholder="Search Medium"]', 'artificial intelligence');
    
    await page.press('input[placeholder="Search Medium"]', 'Enter');

    // Wait for results to load
    await page.waitForSelector('h3');

    const articles = [];
    const uniqueAuthors = new Set();

    // Collect titles, URLs, and authors
    for (let i = 0; i < 3; i++) { // Adjust the number of pages to scrape
        const titles = await page.$$eval('h3', elements => elements.map(el => el.innerText));
        const urls = await page.$$eval('h3 a', elements => elements.map(el => el.href));
        const authors = await page.$$eval('.postMetaInline--author', elements => elements.map(el => el.innerText));

        for (let j = 0; j < titles.length; j++) {
            articles.push({
                article_title: titles[j],
                medium_url: urls[j],
                author: authors[j]
            });
            uniqueAuthors.add(authors[j]);
        }

        // Pagination
        const nextButton = await page.$('button[aria-label="Next"]');
        if (nextButton) {
            await nextButton.click();
            await page.waitForTimeout(2000); // Wait for the next page to load
        } else {
            break; // No more pages
        }
    }

    // Step 3: Find LinkedIn profiles
    const authorLinkedIn = {};
    for (const author of uniqueAuthors) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(author + ' LinkedIn')}`;
        const searchPage = await context.newPage();
        await searchPage.goto(searchUrl);
        await searchPage.waitForTimeout(2000); // Wait for results to load

        const linkedInUrl = await searchPage.$eval('a[href*="linkedin.com"]', el => el.href).catch(() => null);
        if (linkedInUrl) {
            authorLinkedIn[author] = linkedInUrl;
        }
        await searchPage.close();
        if (Object.keys(authorLinkedIn).length >= 10) break; // Stop after finding 10 authors
    }

    // Prepare output
    const output = articles.map(article => ({
        author: article.author,
        article_title: article.article_title,
        medium_url: article.medium_url,
        linkedin_url: authorLinkedIn[article.author] || null
    }));

    // Save to authors.json
    const fs = require('fs');
    fs.writeFileSync('authors.json', JSON.stringify(output, null, 2));

    await browser.close();
})();
