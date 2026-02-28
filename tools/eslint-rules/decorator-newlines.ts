import type { ESLintUtils } from '@typescript-eslint/utils';

type MessageIds = 'propertiesOnOneLine' | 'arrayElementsOnOneLine';
type RuleModule = ESLintUtils.RuleModule<MessageIds>;

const DECORATOR_NAMES = new Set([
  'Component',
  'Directive',
  'Pipe',
  'NgModule',
  'Injectable',
]);
const ARRAY_PROPERTIES = new Set(['imports', 'providers', 'exports']);

function getDecoratorName(node: any): string | null {
  const callExpression = node.parent;
  const decorator = callExpression?.parent;

  if (decorator?.type !== 'Decorator') {
    return null;
  }

  const callee = callExpression.callee;
  const name = callee?.type === 'Identifier' ? callee.name : null;

  return name && DECORATOR_NAMES.has(name) ? name : null;
}

function getLineIndent(sourceCode: any, node: any): string {
  const line = sourceCode.lines[node.loc!.start.line - 1];

  return line.match(/^(\s*)/)![1];
}

const rule: RuleModule = {
  defaultOptions: [],
  meta: {
    type: 'layout',
    docs: {
      description:
        'Enforce Angular decorator metadata properties and array elements each on their own line',
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      propertiesOnOneLine:
        'Angular decorator metadata properties must each be on their own line.',
      arrayElementsOnOneLine:
        'Angular decorator array "{{ property }}" with 2+ elements must have each element on its own line.',
    },
  },

  create(context) {
    return {
      'Decorator > CallExpression > ObjectExpression'(
        node: any // eslint-disable-line @typescript-eslint/no-explicit-any
      ) {
        if (!getDecoratorName(node)) {
          return;
        }

        const sourceCode = context.sourceCode;
        const properties = node.properties;

        if (properties.length === 0) {
          return;
        }

        const openBrace = sourceCode.getFirstToken(node)!;
        const firstProp = properties[0];
        const objectIsSingleLine =
          openBrace.loc!.end.line === firstProp.loc!.start.line;

        // Check 1: Decorator properties on same line as {
        if (objectIsSingleLine) {
          context.report({
            node,
            messageId: 'propertiesOnOneLine',
            fix(fixer) {
              const closeBrace = sourceCode.getLastToken(node)!;
              const baseIndent = getLineIndent(sourceCode, node);
              const propIndent = `${baseIndent}  `;

              const propTexts = properties.map((prop: any) => {
                const text = sourceCode.getText(prop);

                return `${propIndent}${text},`;
              });
              const replacement = `{\n${propTexts.join('\n')}\n${baseIndent}}`;

              return fixer.replaceTextRange(
                [openBrace.range![0], closeBrace.range![1]],
                replacement
              );
            },
          });

          return; // Array check will run on the next lint pass after this fix
        }

        // Check 2: Array properties with 2+ elements on one line
        // (only when object is already multi-line)
        properties.forEach((prop: any) => {
          if (prop.type !== 'Property') {
            return;
          }

          const propName =
            prop.key.type === 'Identifier' ? prop.key.name : null;

          if (!propName || !ARRAY_PROPERTIES.has(propName)) {
            return;
          }

          const arrayNode = prop.value;

          if (
            !arrayNode ||
            arrayNode.type !== 'ArrayExpression' ||
            arrayNode.elements.length < 2
          ) {
            return;
          }

          const openBracket = sourceCode.getFirstToken(arrayNode)!;
          const firstElement = arrayNode.elements[0];

          if (
            !firstElement ||
            openBracket.loc!.end.line !== firstElement.loc!.start.line
          ) {
            return;
          }

          context.report({
            node: arrayNode,
            messageId: 'arrayElementsOnOneLine',
            data: { property: propName },
            fix(fixer) {
              const closeBracket = sourceCode.getLastToken(arrayNode)!;
              const baseIndent = getLineIndent(sourceCode, prop);
              const elementIndent = `${baseIndent}  `;

              const elements = arrayNode.elements.filter(Boolean);
              const elementsText = elements
                .map(
                  (el: any) =>
                    `${elementIndent}${sourceCode.getText(el)},`
                )
                .join('\n');
              const replacement = `[\n${elementsText}\n${baseIndent}]`;

              return fixer.replaceTextRange(
                [openBracket.range![0], closeBracket.range![1]],
                replacement
              );
            },
          });
        });
      },
    };
  },
};

export default rule;
