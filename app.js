if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}


const express = require('express')
const app = express()
const path = require('path')
const methodOverride = require('method-override')
const ejsMate = require('ejs-mate')
app.engine('ejs', ejsMate)
const session = require('express-session')
const flash = require('connect-flash')
const multer = require('multer')
const {storage} = require('./cloudinary.js')
const upload = multer({ storage })

const ExpressError = require('./utils/ExpressError')
const catchAsync = require('./utils/catchAsync')

const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost:27017/yelpcamp')
const db = mongoose.connection
db.on("error", console.error.bind(console, "connection error:"))
db.once("open", () => {
    console.log("Database connected")
})

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))   // setup the public folder to serve static assets


const sessionConfig = {
    secret:'needbettersecret', resave: false, saveUninitialized: true,
    cookie:{httpOnly: true, expires: Date.now() + 1000 * 60 * 60 * 24 * 7, maxAge: 1000 * 60 * 60 * 24 * 7}
}
app.use(session(sessionConfig))
app.use(flash())


const passport = require('passport')
const passportLocal = require('passport-local')
const User = require('./models/user')
app.use(passport.initialize())
app.use(passport.session())  // passport.session() must be after app.use(session())
passport.use(new passportLocal(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

// controller
const controller = require('./controller.js')

// middleware 
const {isLoggedIn, validateCampground, validateReview, isCampAuthor, isReviewAuthor} = require('./middleware.js')

app.use((req,res,next)=>{
    res.locals.currentUser = req.user
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    if(req.originalUrl!=='/login'){
        req.session.returnTo = req.originalUrl
    }
    next()
})

/////////////////////////////////////////////////////////////////

app.get('/', (req, res)=>{
    res.render('home.ejs')
})

app.get('/register', (req, res)=>{
    res.render('users/register.ejs')
})

app.post('/register', catchAsync(controller.register))

app.get('/login', (req, res)=>{
    res.render('users/login.ejs')
})

app.post('/login', passport.authenticate('local', {failureFlash:true, failureRedirect:'/login', keepSessionInfo:true}), 
    controller.login)

app.get('/logout', controller.logout)

app.get('/campgrounds', catchAsync(controller.index))

app.get('/campgrounds/new', isLoggedIn, (req,res)=>{
    res.render('campgrounds/new.ejs')
})

app.post('/campgrounds', isLoggedIn, upload.array('image'), validateCampground, catchAsync(controller.createCampground))

app.get('/campgrounds/:id', catchAsync(controller.showCampground))

app.get('/campgrounds/:id/edit', isLoggedIn, isCampAuthor, catchAsync(controller.renderEditForm))

app.put('/campgrounds/:id', isLoggedIn, isCampAuthor, upload.array('image'), validateCampground, catchAsync(controller.updateCampground))

app.delete('/campgrounds/:id', isLoggedIn, isCampAuthor, catchAsync(controller.deleteCampground))

app.post('/campgrounds/:id/reviews', isLoggedIn, validateReview, catchAsync(controller.createReview))

app.delete('/campgrounds/:id/reviews/:reviewID', isLoggedIn, isReviewAuthor, catchAsync(controller.deleteReview))



app.all('*', (req, res, next)=>{
    next(new ExpressError('Page Not Found', 404))
})

app.use((err,req,res,next)=>{
    const { statusCode = 500 } = err
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error.ejs', {err})
})

app.listen(3000, ()=>{
    console.log('listening on port 3000')
})