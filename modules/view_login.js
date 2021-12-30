const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const psgl = require('./db_postgre')
const e = require('connect-flash')
const { off } = require('process')
const { all } = require('./line_receiver')
const login = require('./view_login')

const signin = (request, response) => {
  try {
    const userReq = request.body
    let user
    console.log(userReq)
    findUser(userReq)
      .then(foundUser => {
        user = foundUser
        return checkPassword(userReq.Password, foundUser)
      })
      .then((res) => createToken())
      .then(token => updateUserToken(token, user))
      .then(() => {
        delete user.Password
        //response.status(200).json(user)
        response.render('pages/home/index')
      })
      .catch((err) => {
        console.error("ERROR scope@signin： "+err);
        response.status(403)
      })
  } catch (error) {
    console.error("ERROR @signin： "+error);
    response.status(401)
  }
}

const findUser = async (userReq) => {
  return await psgl.sqlToPostgre(`SELECT * FROM public."Admin" WHERE "Name" = '${userReq.ID}';`)
    .then((data) => data[0])
}

const checkPassword = (reqPassword, foundUser) => {
  return new Promise((resolve, reject) =>
    bcrypt.compare(reqPassword, foundUser.Password, (err, response) => {
        if (err) {
          reject(err)
          response.status(403)
        }
        else if (response) {
          resolve(response)
        } else {
          reject(new Error('Passwords do not match.'))
          response.status(403)
        }
    })
  )
}

// crypto ships with node - we're leveraging it to create a random, secure token
const createToken = () => {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, data) => {
      err ? reject(err) : resolve(data.toString('base64'))
    })
  })
}


// check out bcrypt's docs for more info on their hashing function
const hashPassword = (password) => {
  return new Promise((resolve, reject) =>
    bcrypt.hash(password, 10, (err, hash) => {
      err ? reject(err) : resolve(hash)
    })
  )
}

// user will be saved to db - we're explicitly asking postgres to return back helpful info from the row created
const createUser = (user) => {
  return database.raw(
    "INSERT INTO users (username, password_digest, token, created_at) VALUES (?, ?, ?, ?) RETURNING id, username, created_at, token",
    [user.Name, user.Password, user.Token, new Date()]
  )
  .then((data) => data.rows[0])
}

const updateUserToken = async (token, user) => {
  return await psgl.sqlToPostgre(`UPDATE public."Admin" SET "Token" = ${token} WHERE "ID" = ${user.id} RETURNING "ID", "Name", "Token" `)
    .then((data) => data.rows[0])
}


const authenticate = (userReq) => {
  findByToken(userReq.token)
    .then((user) => {
      if (user.username == userReq.username) {
        return true
      } else {
        return false
      }
    })
}

const findByToken = async (token) => {
  return await psgl.sqlToPostgre(`SELECT * FROM public."Admin" WHERE "Token" = ${token}`)
    .then((data) => data.rows[0])
}

/*const signup = (request, response) => {
  const user = request.body
  hashPassword(user.password)
    .then((hashedPassword) => {
      delete user.password
      user.password_digest = hashedPassword
    })
    .then(() => createToken())
    .then(token => user.token = token)
    .then(() => createToken(user))
    .then(user => {
      delete user.password_digest
      response.status(201).json({ user })
    })
    .catch((err) => console.error(err))
}*/

module.exports = {
  signin
}