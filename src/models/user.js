module.exports = (sequelize, Sequelize) =>{
const User  = sequelize.define( 'User', {
    email:{
        primaryKey: true,
        type: Sequelize.STRING(50),
        allowNull: false // allowNull Defaults to true
    },
    firstName:{
        type: Sequelize.STRING(45),
    },
    lastName:{
        type: Sequelize.STRING(45),
    },
    password:{
        type: Sequelize.STRING
    },
    credit:{
        type: Sequelize.BIGINT
    },
    pin:{
        type: Sequelize.STRING(10)
    }
},{
    tableName: 'user',
    timestamps: true
});

return User
}
