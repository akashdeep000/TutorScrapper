const axios = require('axios');
const cheerio = require('cheerio');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { default: limit } = require('p-limit');
const fs = require('fs').promises;
const path = require('path');

const LOCATIONS = [
    // New South Wales
    "sydney",
    "coffs-harbour",
    "hunter-valley",
    "lake-macquarie",
    "lismore",
    "newcastle",
    "northern-beaches",
    "nsw-central-coast",
    "nsw-central-west",
    "nsw-north-coast",
    "nsw-south-coast",
    "port-macquarie",
    "tamworth",
    "taree",
    "wagga-wagga",
    "wollongong",
    // Online
    "online",
    // Queensland
    "brisbane",
    "cairns",
    "central-queensland",
    "darling-downs",
    "gold-coast",
    "ipswich",
    "mackay",
    "north-queensland",
    "qld-far-north",
    "sunshine-coast",
    "townsville",
    "wide-bay-burnett",
    // South Australia
    "adelaide",
    "sa-far-north",
    "sa-mid-north",
    "sa-south",
    "sa-west",
    // Victoria
    "melbourne",
    "albury-wodonga",
    "ballarat",
    "bendigo",
    "vic-east",
    "geelong",
    "mornington-peninsula",
    "vic-north",
    "vic-west",
    // ACT
    "canberra",
    // Northern Territory
    "darwin",
    "katherine",
    // Western Australia
    "perth",
    "wa-gascoyne",
    "wa-goldfields",
    "wa-great-southern",
    "wa-kimberley",
    "wa-mid-west",
    "wa-peel",
    "wa-pilbara",
    "wa-south-west",
    "wa-wheatbelt",
    // Tasmania
    "hobart",
    "launceston",
    "tas-east-coast",
    "tas-north-west",
];

const SUBJECTS = [
    "biology",
    "chemistry",
    "economics",
    "english",
    "english-language",
    "english-literature",
    "general-maths",
    "maths-methods",
    "maths-specialist",
    "physics",
    // New subjects
    "french",
    "spanish",
    "cantonese",
    "japanese",
];

const BASE_URL = "https://www.tutorfinder.com.au";
const CACHE_DIR = "html_cache";

const csvWriter = createCsvWriter({
    path: 'tutor_data.csv',
    header: [
        { id: 'link', title: 'Link' },
        { id: 'name', title: 'Name' },
        { id: 'contactInfo', title: 'Contact Info' },
        { id: 'experience', title: 'Experience' },
        { id: 'qualifications', title: 'Qualifications' },
        { id: 'rates', title: 'Rates' },
        { id: 'gender', title: 'Gender' },
        { id: 'registered', title: 'Registered' },
        { id: 'location', title: 'Location' },
        { id: 'subject', title: 'Subject' },
        { id: 'emailExtract', title: 'email_extract' },
        { id: 'mobileExtract', title: 'mobile_extract' },
    ]
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(url, retries = 3) {
    const urlHash = Buffer.from(url).toString('base64url');
    const cacheFilePath = path.join(CACHE_DIR, `${urlHash}.html`);

    try {
        // Try to read from cache first
        const cachedHtml = await fs.readFile(cacheFilePath, 'utf8');
        console.log(`Serving from cache: ${url}`);
        return cachedHtml;
    } catch (cacheError) {
        // If not in cache, fetch from network
        console.log(`Fetching from network: ${url}`);
        for (let i = 0; i < retries; i++) {
            try {
                await delay(2000); // 2-second delay between requests
                const response = await axios.get(url);
                const html = response.data;

                // Save to cache
                await fs.writeFile(cacheFilePath, html);
                console.log(`Saved to cache: ${url}`);
                return html;
            } catch (error) {
                console.error(`Error fetching ${url} (attempt ${i + 1}/${retries}): ${error.message}`);
                if (i === retries - 1) throw error;
                await delay(5000 * (i + 1)); // Exponential backoff
            }
        }
    }
}

async function scrapeSearchResults(location, subject) {
    let allTutorLinks = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const url = `${BASE_URL}/regions/${location}/${subject}/?Page=${page}`;
        console.log(`Scraping search results for ${location}, ${subject}, page ${page}: ${url}`);
        try {
            const html = await fetchPage(url);
            const $ = cheerio.load(html);

            const tutorLinksOnPage = [];
            $('table.tf-table tbody tr.clickable-row').each((i, element) => {
                const link = $(element).attr('data-href');
                if (link) {
                    tutorLinksOnPage.push(link);
                }
            });

            if (tutorLinksOnPage.length > 0) {
                allTutorLinks = allTutorLinks.concat(tutorLinksOnPage);
                // Check for next page by looking at pagination links
                const nextButton = $(`ul.pagination a.page-link:contains('${page + 1}')`);
                hasNextPage = nextButton.length > 0;
                page++;
            } else {
                hasNextPage = false; // No more tutors or pages
            }

        } catch (error) {
            console.error(`Failed to scrape search results for ${location}, ${subject}, page ${page}: ${error.message}`);
            hasNextPage = false; // Stop if there's an error
        }
    }
    return allTutorLinks;
}

async function scrapeTutorProfile(profileUrl) {
    console.log(`Scraping tutor profile: ${profileUrl}`);
    try {
        const html = await fetchPage(profileUrl);
        const $ = cheerio.load(html);

        const tutorData = {
            link: profileUrl,
            name: '',
            contactInfo: '',
            experience: '',
            qualifications: '',
            rates: '',
            gender: '',
            registered: '',
            location: '',
            subject: '',
            emailExtract: 'N/A',
            mobileExtract: 'N/A'
        };

        // Extract Name
        tutorData.name = $('.tf-profile-header h1').first().text().trim();

        // Extract Location and clean duplicates
        tutorData.location = $('.tf-profile-header h1 span.c_blue').text().trim();

        // Extract Experience, Qualifications, Rates, Gender, Registered
        const profileOuterHtml = $('.tf-profile').prop('outerHTML'); // Get the full HTML of the profile section

        const extractContentByHeader = (htmlContent, headerName) => {
            // Use regex to find the header and capture content until the next header or section end
            const regex = new RegExp(`<h3[^>]*>\\s*${headerName}\\s*<\\/h3>\\s*([\\s\\S]*?)(?:<h3[^>]*>|\\s*<div class="tf-submit-container">|$)`, 'i');
            const match = htmlContent.match(regex);
            if (match && match[1]) {
                // Load the matched HTML content into a new cheerio instance to get clean text
                return cheerio.load(match[1]).text().trim();
            }
            return '';
        };

        tutorData.experience = extractContentByHeader(profileOuterHtml, 'Experience');
        tutorData.qualifications = extractContentByHeader(profileOuterHtml, 'Qualifications');
        tutorData.rates = extractContentByHeader(profileOuterHtml, 'Rates');
        tutorData.gender = extractContentByHeader(profileOuterHtml, 'Gender');
        // Special handling for "Registered" to clean up extra characters
        tutorData.registered = extractContentByHeader(profileOuterHtml, 'Registered')
            .replace(/\(updated profile on \d{2}-\w{3}-\d{4}\)/, '')
            .replace(/\)$/, '')
            .trim();

        // Extract Contact Info (email and mobile)
        let allContactInfo = [];
        $('span.c_link').each((idx, el) => {
            allContactInfo.push($(el).text().trim());
        });
        tutorData.contactInfo = allContactInfo.join('\n');

        // Extract email from allContactInfo
        const emailMatch = allContactInfo.find(info => info.includes('@'));
        if (emailMatch) {
            tutorData.emailExtract = emailMatch;
        }

        // Extract mobile from allContactInfo
        const mobileMatch = allContactInfo.find(info => info.match(/(?:(?:\(0[2-8]\)|0[2-8])?\s?\d{4}\s?\d{4}|04\d{2}\s?\d{3}\s?\d{3})/));
        if (mobileMatch) {
            tutorData.mobileExtract = mobileMatch.replace(/\s/g, '');
        }

        return tutorData;

    } catch (error) {
        console.error(`Failed to scrape tutor profile ${profileUrl}: ${error}`);
        return null;
    }
}

// Convert a slug like "nsw-central-coast" to "NSW Central Coast"
function formatLocationLabel(slug) {
    const overrides = {
        'nsw-central-coast': 'NSW Central Coast',
        'nsw-central-west': 'NSW Central West',
        'nsw-north-coast': 'NSW North Coast',
        'nsw-south-coast': 'NSW South Coast',
        'qld-far-north': 'QLD Far North',
        'sa-far-north': 'SA Far North',
        'sa-mid-north': 'SA Mid North',
        'sa-south': 'SA South',
        'sa-west': 'SA West',
        'vic-east': 'Eastern Victoria',
        'vic-north': 'Northern Victoria',
        'vic-west': 'Western Victoria',
        'wa-gascoyne': 'WA Gascoyne',
        'wa-goldfields': 'WA Goldfields',
        'wa-great-southern': 'WA Great Southern',
        'wa-kimberley': 'WA Kimberley',
        'wa-mid-west': 'WA Mid West',
        'wa-peel': 'WA Peel',
        'wa-pilbara': 'WA Pilbara',
        'wa-south-west': 'WA South West',
        'wa-wheatbelt': 'WA Wheatbelt',
        'tas-east-coast': 'TAS East Coast',
        'tas-north-west': 'TAS North West',
    };
    if (overrides[slug]) return overrides[slug];
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatSubjectLabel(slug) {
    const overrides = {
        'english-language': 'English Language',
        'english-literature': 'English Literature',
        'general-maths': 'General Maths',
        'maths-methods': 'Maths Methods',
        'maths-specialist': 'Maths Specialist',
    };
    if (overrides[slug]) return overrides[slug];
    return slug.charAt(0).toUpperCase() + slug.slice(1);
}

async function main() {
    // Ensure cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    let allTutorsData = [];
    const limiter = limit(50); // Limit to 50 concurrent requests

    for (const location of LOCATIONS) {
        for (const subject of SUBJECTS) {
            console.log(`Starting scraping for Location: ${location}, Subject: ${subject}`);
            const tutorLinks = await scrapeSearchResults(location, subject);
            console.log(`Found ${tutorLinks.length} tutor links for ${location}, ${subject}`);

            const profilePromises = tutorLinks.map(link => limiter(() => scrapeTutorProfile(link)));
            const results = await Promise.all(profilePromises);

            results.forEach(tutorData => {
                if (tutorData) {
                    allTutorsData.push({
                        ...tutorData,
                        subject: formatSubjectLabel(subject),
                        location: formatLocationLabel(location)
                    });
                }
            });
        }
    }

    console.log('Writing data to CSV...');
    await csvWriter.writeRecords(allTutorsData)
        .then(() => {
            console.log('CSV file written successfully!');
        })
        .catch(err => {
            console.error('Error writing CSV file:', err);
        });
}

main();
