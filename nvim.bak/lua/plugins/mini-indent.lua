return {
    "echasnovski/mini.indentscope",
    version = false,
    event = { "BufReadPre", "BufNewFile" },
    config = function()
        require("mini.indentscope").setup({
            symbol = "│",
            options = { try_as_border = true },
            draw = {
                animation = require("mini.indentscope").gen_animation.cubic({
                    easing = "out",
                    duration = 250,
                    unit = "total",
                }),
            },
        })
    end,
    init = function()
        vim.api.nvim_create_autocmd("FileType", {
            pattern = {
                "help",
                "alpha",
                "dashboard",
                "neo-tree",
                "Trouble",
                "lazy",
                "mason",
            },
            callback = function()
                vim.b.miniindentscope_disable = true
            end,
        })
    end,
}
