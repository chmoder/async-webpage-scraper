const fs = require('fs');
const csv = require('csv-parser');
const puppeteer = require('puppeteer')
const {default: PQueue} = require('p-queue');
const { htmlToText } = require('html-to-text');

// Set this to how many pages you want to scrape concurrently
const queue = new PQueue({
    concurrency: 32
});

let category_count = {
    'domain reseller': 0
};

function domain_is_for_sale(text) {
    if(text.toLowerCase().includes('domain') && (
	    text.toLowerCase().includes('sale') || 
	    text.toLowerCase().includes('domain') ||
	    text.toLowerCase().includes('expire') ||
	    text.toLowerCase().includes('buy') ||
	    text.toLowerCase().includes('purchase') ||
	    text.toLowerCase().includes('sell')
    )) {
        return true;
    } else if(text.toLowerCase().includes('your browser')) {
        return true;
    } else if(text.toLowerCase().includes('enable javascript')) {
        return true;
    } else if(text.toLowerCase().includes('godaddy') && text.toLowerCase().includes('reseller')) {
        return true
    } else if(text.toLowerCase().includes('domain') && (text.toLowerCase().includes('expire') || text.toLowerCase().includes('expired'))) {
        return true;
    } else if (text.toLowerCase().includes('forbidden') && (text.toLowerCase().includes('permission') || text.toLowerCase().includes('403'))) {
        return true;
    }

    return false;
}

function domain_has_requirements(text) {
    if(text.toLowerCase().includes('your browser')) {
        return true;
    } else if(text.toLowerCase().includes('enable javascript')) {
        return true;
    } else if (text.toLowerCase().includes('forbidden') && (text.toLowerCase().includes('permission') || text.toLowerCase().includes('403'))) {
        return true;
    }

    return false
}

(
    async () => {
        // task processor function
        const createInstance = async (url, category) => {
            if(!(category in category_count)) {
                category_count[category] = 0;
            }

            if(category_count[category] >= 500) {
                return;
            }

            let browser = puppeteer.launch({
                launch: {
                    headless: true,
                },
                args: [
                    "--disable-setuid-sandbox",
                    '--shm-size=12gb'
                ],
                'ignoreHTTPSErrors': true,
                browserContext: "default",
            });
            let real_browser = await browser;
            let page = await real_browser.newPage();
            let res = null;

            try {
                await page.goto(url, {waitUntil: 'networkidle2',timeout: 5000}).catch(e => {
                    console.log(e);
                    if(!page.isClosed()) {
                        let res =  page.close();
                        real_browser.close();
                        return res;
                    }
                });

                let html_body = await page.evaluate(() => {
                    return document.documentElement.outerHTML;
                });


                html_body = htmlToText(html_body)

                // only accept alpha numeric
                html_body = html_body.replace(/\W/g, ' ')

                // replace all whitespace with one space
                html_body = html_body.replace(/\s\s+/g, ' ');

                html_body = html_body.trim()

                if (!domain_has_requirements(html_body)) {
                    if(domain_is_for_sale(html_body)) {
                        category = 'domain reseller'
                    }

                    if(category_count[category] >= 500) {
                        return;
                    }

                    const csv_line = html_body + ',' + category + '\n';

                    // console.log(csv_line);
                    fs.writeFile('text_labels.csv', csv_line, {flag: "a+"}, function (err) {
                        if (err) throw err;
                    });
                    category_count[category] += 1;
                    console.log(category_count);
                }
            } finally {
                if(!page.isClosed()) {
                    res = await page.close();
                }
                await real_browser.close();
            }

            return res;
        }

        fs.createReadStream('domain_category_mapping.csv')
            .pipe(csv())
            .on('data', (row) => {
                const category = row.category;
                const domain = row.domain;
                if (!domain) {
                    return;
                }
                const url = 'http://' + domain;

                // console.log(url + ' ' + category);

                (async () => {
                    await queue.add(() => createInstance(url, category)).catch(e => {console.log(e)});
                })();
            })
            .on('end', () => {
                console.log('CSV file successfully processed');
            });
    }
)()
