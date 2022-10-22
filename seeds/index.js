
const cities = require('./cities');
const {places, descriptors} = require('./seedHelpers')
const Campground = require('../models/campground');

const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost:27017/yelpcamp')
const db = mongoose.connection
db.on("error", console.error.bind(console, "connection error:"))
db.once("open", () => {
    console.log("Database connected")
})


// a function return a random element of an array
const sample = (array) => array[Math.floor(Math.random() * array.length)];

const seedDB = async () => {
    await Campground.deleteMany({})
    for (let i = 0; i < 50; i++) {
        const random1000 = Math.floor(Math.random() * 1000);
        const price = Math.floor(Math.random()*20) + 10;
        const camp = new Campground({
            author: '634f588fc7eaf46b9f591cad', 
            location: `${cities[random1000].city}, ${cities[random1000].state}`,
            title: `${sample(descriptors)} ${sample(places)}`,
            //image: 'https://source.unsplash.com/collection/483251',
            description: 'A campsite, also known as a campground or camping pitch, is a place used for overnight stay in an outdoor area. In British English, a campsite is an area, usually divided into a number of pitches, where people can camp overnight using tents, campervans or caravans; this British English use of the word is synonymous with the US English expression campground. In American English, the term campsite generally means an area where an individual, family, group, or military unit can pitch a tent or park a camper; a campground may contain many campsites.',
            price: price,
            geometry:{
              type:'Point',
              coordinates:[
                cities[random1000].longitude,
                cities[random1000].latitude
              ]
            },
            images: [
                {
                  url: 'https://res.cloudinary.com/du8mbncbq/image/upload/v1666298721/YelpCamp/cue3wnlzuoiqdevij23o.jpg',
                  filename: 'YelpCamp/cue3wnlzuoiqdevij23o',
                },
                {
                  url: 'https://res.cloudinary.com/du8mbncbq/image/upload/v1666298721/YelpCamp/qkei8rcxpj1hwnp2xhxz.jpg',
                  filename: 'YelpCamp/qkei8rcxpj1hwnp2xhxz',
                }
              ]
        })

        await camp.save();
    }
}

seedDB().then(() => {
    mongoose.connection.close();
})