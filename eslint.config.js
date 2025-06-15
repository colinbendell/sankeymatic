import js from "@eslint/js";

export default [
  {
    ...js.configs.recommended,
    "rules": {
      "indent": [ "error", 2 ],
      "arrow-parens": [ "error", "as-needed" ]
    },
    "languageOptions": {
      "sourceType": "module",
      "ecmaVersion": "latest",
    }
  }
]
